import { UpdateInfo } from "electron-updater";
import { FC, useCallback, useEffect, useState } from "react";

const Update: FC = () => {

	const [state, setState] = useState<string>('idle');

	const checkForUpdate = useCallback(async () => {
		const updateInfo = await bridge.call<UpdateInfo>('updateService', 'checkForUpdates');
		setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
			return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
		}).join('\n'));
	}, []);

	useEffect(() => {
		const subscription = bridge.on('updateService', 'onError').subscribe((error: any) => {
			setState(error.code);
		});
		return () => {
			subscription.unsubscribe();
		}
	}, []);
	
	useEffect(() => {
		const subscription = bridge.on('updateService', 'onCheckingForUpdate').subscribe(() => {
			setState('checking update');
		});
		return () => {
			subscription.unsubscribe();
		}
	}, []);

	useEffect(() => {
		const subscription = bridge.on('updateService', 'onUpdateAvailable').subscribe((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
		return () => {
			subscription.unsubscribe();
		};
	}, []);
	
	useEffect(() => {
		const subscription = bridge.on('updateService', 'onUpdateNotAvailable').subscribe((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
		return () => {
			subscription.unsubscribe();
		}
	}, []);
	
	useEffect(() => {
		const subscription = bridge.on('updateService', 'onDownloadProgress').subscribe((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
		return () => {
			subscription.unsubscribe();
		};
	}, []);
	
	useEffect(() => {
		const subscription = bridge.on('updateService', 'onUpdateDownloaded').subscribe((updateInfo: UpdateInfo) => {
			setState(Reflect.ownKeys(updateInfo).map((key: string | Symbol) => {
				return `${key}: ${updateInfo[key as keyof UpdateInfo]}`;
			}).join('\n'));
		});
		return () => {
			subscription.unsubscribe();
		};
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