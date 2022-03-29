
export enum UpdateEvents {
	ERROR = 'error',
	CHECKING_FOR_UPDATE = 'checkingForUpdate',
	UPDATE_NOT_AVAILABLE = 'updateNotAvailable',
	UPDATE_AVAILABLE = 'updateAvailable',
	DOWNLOAD_PROGRESS = 'downloadProgress',
	UPDATE_DOWNLOADED = 'updateDownloaded',
}

export enum UpdateCommands {
	CHECK_FOR_UPDATES = 'checkForUpdates',
	CHECK_FOR_UPDATES_AND_NOTIFY = 'checkForUpdatesAndNotify',
}