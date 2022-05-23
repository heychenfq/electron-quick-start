/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ipcRenderer } from 'electron';
import { inject, service } from '@electron-tools/ioc';
import { VSBuffer } from '../../../core/base/buffer';
import { Event } from '../../../core/base/event';
import { IDisposable } from '../../../core/base/lifecycle';
import { LogService } from '../../log/common/log';
import { IPCClient } from '../common/ipc';
import { Protocol as ElectronProtocol } from '../common/ipc';

/**
 * An implementation of `IPCClient` on top of Electron `ipcRenderer` IPC communication
 * provided from sandbox globals (via preload script).
 */
@service('ipcRendererClient')
export class IPCRendererClient extends IPCClient implements IDisposable {

	private protocol: ElectronProtocol;

	private static createProtocol(): ElectronProtocol {
		const onMessage = Event.fromNodeEventEmitter<VSBuffer>(ipcRenderer, 'vscode:message', (_, message) => VSBuffer.wrap(message));
		ipcRenderer.send('vscode:hello');

		return new ElectronProtocol(ipcRenderer, onMessage);
	}

	constructor(
		@inject('logService')
		logService: LogService,
	) {
		const protocol = IPCRendererClient.createProtocol();
		super(protocol, logService);
		this.protocol = protocol;
	}

	override dispose(): void {
		super.dispose();
		this.protocol.disconnect();
	}
}
