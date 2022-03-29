/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ipcMain, WebContents } from 'electron';
import { VSBuffer } from '../../../core/base/buffer';
import { Emitter, Event } from '../../../core/base/event';
import { IDisposable, toDisposable } from '../../../core/base/lifecycle';
import { inject, service } from '../../instantiation/common/instantiation';
import { LogService } from '../../log/common/log';
import { ClientConnectionEvent, IPCServer, Protocol } from '../common/ipc';

interface IIPCEvent {
	event: { sender: WebContents };
	message: Buffer | null;
}

function createScopedOnMessageEvent(senderId: number, eventName: string): Event<VSBuffer | null> {
	const onMessage = Event.fromNodeEventEmitter<IIPCEvent>(ipcMain, eventName, (event, message) => ({ event, message }));
	const onMessageFromSender = Event.filter(onMessage, ({ event }) => event.sender.id === senderId);

	return Event.map(onMessageFromSender, ({ message }) => message ? VSBuffer.wrap(message) : message);
}

/**
 * An implementation of `IPCServer` on top of Electron `ipcMain` API.
 */

@service('ipcMainServer')
export class IpcMainServer extends IPCServer {

	private static readonly Clients = new Map<number, IDisposable>();

	private static getOnDidClientConnect(): Event<ClientConnectionEvent<string>> {
		const onHello = Event.fromNodeEventEmitter<WebContents>(ipcMain, 'vscode:hello', ({ sender }) => sender);
		return Event.map(onHello, webContents => {
			const id = webContents.id;
			const client = IpcMainServer.Clients.get(id);

			if (client) {
				client.dispose();
			}

			const onDidClientReconnect = new Emitter<void>();
			IpcMainServer.Clients.set(id, toDisposable(() => onDidClientReconnect.fire()));

			const onMessage = createScopedOnMessageEvent(id, 'vscode:message') as Event<VSBuffer>;
			const onDidClientDisconnect = Event.any(Event.signal(createScopedOnMessageEvent(id, 'vscode:disconnect')), onDidClientReconnect.event);
			const protocol = new Protocol(webContents, onMessage);

			return { protocol, onDidClientDisconnect, ctx: id.toString() };
		});
	}

	constructor(
		@inject('logService')
		logService: LogService,
	) {
		super(IpcMainServer.getOnDidClientConnect(), logService);
	}
}
