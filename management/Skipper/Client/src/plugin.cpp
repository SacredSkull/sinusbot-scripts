/*
 * TeamSpeak 3 demo plugin
 *
 * Copyright (c) 2008-2017 TeamSpeak Systems GmbH
 */

#ifdef _WIN32
#pragma warning (disable : 4100)  /* Disable Unreferenced parameter warning */
#include <Windows.h>
#endif

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "teamspeak/public_errors.h"
#include "teamspeak/public_errors_rare.h"
#include "teamspeak/public_definitions.h"
#include "teamspeak/public_rare_definitions.h"
#include "teamspeak/clientlib_publicdefinitions.h"
#include "ts3_functions.h"
#include "plugin.h"

#define PLUGIN_API_VERSION 22

static struct TS3Functions ts3Functions;

// Helpers //

#ifdef _WIN32
#define _strcpy(dest, destSize, src) strcpy_s(dest, destSize, src)
#define snprintf sprintf_s
#else
#define _strcpy(dest, destSize, src) { strncpy(dest, src, destSize-1); (dest)[destSize-1] = '\0'; }
#endif

static anyID ClientID = NULL;
static uint64 ServerConnectionHandlerID = NULL;
static char* pluginID = nullptr;

#ifdef _WIN32
/* Helper function to convert wchar_T to Utf-8 encoded strings on Windows */
static int wcharToUtf8(const wchar_t* str, char** result) {
	int outlen = WideCharToMultiByte(CP_UTF8, 0, str, -1, nullptr, 0, nullptr, nullptr);
	*result = (char*)malloc(outlen);
	if (WideCharToMultiByte(CP_UTF8, 0, str, -1, *result, outlen, nullptr, nullptr) == 0) {
		*result = nullptr;
		return -1;
	}
	return 0;
}
#endif

// End Helpers //

/* Set TeamSpeak 3 callback functions */
void ts3plugin_setFunctionPointers(const struct TS3Functions funcs) {
	ts3Functions = funcs;
}

const char* ts3plugin_name() {
	static char* result = nullptr;  /* Static variable so it's allocated only once */
	if (!result) {
		const wchar_t* name = L"Skipper Mate";
		if (wcharToUtf8(name, &result) == -1) {  /* Convert name into UTF-8 encoded result */
			result = "Skipper Mate";  /* Conversion failed, fallback here */
		}
	}
	return result;
}

const char* ts3plugin_description() {
	static char* result = nullptr;  /* Static variable so it's allocated only once */
	if (!result) {
		const wchar_t* name = L"Exposes a hotkey to use the !skip command. May add full Now Playing GUI in the future!";
		if (wcharToUtf8(name, &result) == -1) {  /* Convert name into UTF-8 encoded result */
			result = "Exposes a hotkey to use the !skip command. May add full Now Playing GUI in the future!";  /* Conversion failed, fallback here */
		}
	}
	return result;
}

const char* ts3plugin_version() {
	return SKIPPER_VERSION;
}

const char* ts3plugin_author() {
	/* If you want to use wchar_t, see ts3plugin_name() on how to use */
	return "SacredSkull <me@sacredskull.net>";
}

int ts3plugin_apiVersion() {
	return PLUGIN_API_VERSION;
}

/*
* Custom code called right after loading the plugin. Returns 0 on success, 1 on failure.
* If the function returns 1 on failure, the plugin will be unloaded again.
*/
int ts3plugin_init() {
	return 0;  /* 0 = success, 1 = failure, -2 = failure but client will not show a "failed to load" warning */
			   /* -2 is a very special case and should only be used if a plugin displays a dialog (e.g. overlay) asking the user to disable
			   * the plugin again, avoiding the show another dialog by the client telling the user the plugin failed to load.
			   * For normal case, if a plugin really failed to load because of an error, the correct return value is 1. */
}

void ts3plugin_shutdown() {
	/* Free pluginID if we registered it */
	if (pluginID) {
		free(pluginID);
		pluginID = nullptr;
	}
}

/*
* If the plugin wants to use error return codes, plugin commands, hotkeys or menu items, it needs to register a command ID. This function will be
* automatically called after the plugin was initialized. This function is optional. If you don't use these features, this function can be omitted.
* Note the passed pluginID parameter is no longer valid after calling this function, so you must copy it and store it in the plugin.
*/
void ts3plugin_registerPluginID(const char* id) {
	const size_t sz = strlen(id) + 1;
	pluginID = (char*)malloc(sz * sizeof(char));
	_strcpy(pluginID, sz, id);  /* The id buffer will invalidate after exiting this function */
	printf("PLUGIN: registerPluginID: %s\n", pluginID);
}

int ts3plugin_requestAutoload() {
	return 1;  /* 1 = request autoloaded, 0 = do not request autoload */
}

/* Helper function to create a hotkey */
static struct PluginHotkey* createHotkey(const char* keyword, const char* description) {
	struct PluginHotkey* hotkey = (struct PluginHotkey*)malloc(sizeof(struct PluginHotkey));
	_strcpy(hotkey->keyword, PLUGIN_HOTKEY_BUFSZ, keyword);
	_strcpy(hotkey->description, PLUGIN_HOTKEY_BUFSZ, description);
	return hotkey;
}

/* Some macros to make the code to create hotkeys a bit more readable */
#define BEGIN_CREATE_HOTKEYS(x) const size_t sz = x + 1; size_t n = 0; *hotkeys = (struct PluginHotkey**)malloc(sizeof(struct PluginHotkey*) * sz);
#define CREATE_HOTKEY(a, b) (*hotkeys)[n++] = createHotkey(a, b);
#define END_CREATE_HOTKEYS (*hotkeys)[n++] = NULL; assert(n == sz);

/*
*Hotkeys require ts3plugin_registerPluginID and ts3plugin_freeMemory to be implemented.
* This function is automatically called by the client after ts3plugin_init.
*/
void ts3plugin_initHotkeys(struct PluginHotkey*** hotkeys) {
	/* Register hotkeys giving a keyword and a description.
	* The keyword will be later passed to ts3plugin_onHotkeyEvent to identify which hotkey was triggered.
	* The description is shown in the clients hotkey dialog. */
	BEGIN_CREATE_HOTKEYS(1);  /* Create 1 hotkey. Size must be correct for allocating memory. */
	CREATE_HOTKEY("skipper_skip", "Hotkey to skip the current song (requires Sinusbot and the Skipper plugin installed on the server to function)");
	END_CREATE_HOTKEYS;

	/* The client will call ts3plugin_freeMemory to release all allocated memory */
}

void ts3plugin_onConnectStatusChangeEvent(uint64 serverConnectionHandlerID, int newStatus, unsigned int errorNumber) {
	if (newStatus == STATUS_CONNECTION_ESTABLISHED) {  /* connection established and we have client and channels available */
		ServerConnectionHandlerID = serverConnectionHandlerID;
		if (ts3Functions.getClientID(ServerConnectionHandlerID, &ClientID) != ERROR_ok)
			ClientID = NULL;
	}
	else {
		ServerConnectionHandlerID = NULL;
		ClientID = NULL;
	}
}

void ts3plugin_freeMemory(void* data) {
	free(data);
}

// Handle hotkey
void ts3plugin_onHotkeyEvent(const char* keyword) {
	printf("PLUGIN: Hotkey event: %s\n", keyword);
	if (strcmp("skipper_skip", keyword) == 0 && ServerConnectionHandlerID != NULL) {
		uint64 channelID = NULL;
		if(ClientID != NULL && ts3Functions.getChannelOfClient(ServerConnectionHandlerID, ClientID, &channelID) == ERROR_ok)
			ts3Functions.requestSendChannelTextMsg(ServerConnectionHandlerID, "!skip", channelID, nullptr);
	}
}

const char* ts3plugin_keyPrefix() {
	return NULL;
}