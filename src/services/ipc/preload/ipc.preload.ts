/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ipcRenderer } from 'electron';
import { VSBuffer } from '../../../core/base/buffer';
import { Event } from '../../../core/base/event';
import { IDisposable } from '../../../core/base/lifecycle';
import { service } from '../../instantiation/common/instantiation';
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

	constructor() {
		const protocol = IPCRendererClient.createProtocol();
		super(protocol, Math.random().toString().slice(2, 8));

		this.protocol = protocol;
	}

	override dispose(): void {
		this.protocol.disconnect();
	}
}