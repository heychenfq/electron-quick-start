import { UpdateInfo } from "electron-updater";
import { FC, useCallback, useEffect, useState } from "react";

const Update: FC = () => {

	const [state, setState] = useState<string>('idle');

	const checkForUpdate = useCallback(() => {
		nativeHost.call('updateService', 'checkForUpdates');
	}, []);

	useEffect(() => {
		return nativeHost.on('updateService', 'onError')((error: any) => {
			setState(error.description);
		});
	}, []);
	
	useEffect(() => {
		return nativeHost.on('updateService', 'onCheckingForUpdate')(() => {
			setState('checking update');
		});
	}, []);

	useEffect(() => {
		return nativeHost.on('updateService', 'onUpdateAvailable')((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
	}, []);
	
	useEffect(() => {
		return nativeHost.on('updateService', 'onUpdateNotAvailable')((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
	}, []);
	
	useEffect(() => {
		return nativeHost.on('updateService', 'onDownloadProgress')((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
	}, []);
	
	useEffect(() => {
		return nativeHost.on('updateService', 'onUpdateDownloaded')((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
	}, []);

	return (
		<div>
			<header>Update Components</header>
			<button onClick={checkForUpdate}>check update</button>
			<div>{state}</div>
		</div>
	);
}

Update.displayName = 'Update';

export default Update;