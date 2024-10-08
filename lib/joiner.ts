import {Joiner, ClientAuthenticator, Serializer, JSONSerializer} from 'wampproto';

import {BaseSession} from './types';
import {getSubProtocol} from './helpers';


export class WAMPSessionJoiner {
    private readonly _authenticator?: ClientAuthenticator;
    private readonly _serializer: Serializer;

    constructor(joinerOptions: { authenticator?: ClientAuthenticator, serializer?: Serializer }) {
        this._serializer = joinerOptions.serializer || new JSONSerializer();
        this._authenticator = joinerOptions.authenticator;
    }

    async join(uri: string, realm: string): Promise<BaseSession> {
        const ws = new WebSocket(uri, [getSubProtocol(this._serializer)]);

        const joiner = new Joiner(realm, this._serializer, this._authenticator);

        ws.addEventListener('open', () => {
            ws.send(joiner.sendHello());
        });

        return new Promise<BaseSession>((resolve, reject) => {
            const wsMessageHandler = (event: MessageEvent) => {
                try {
                    const toSend = joiner.receive(event.data);
                    if (!toSend) {
                        ws.removeEventListener('message', wsMessageHandler);
                        ws.removeEventListener('close', closeHandler);

                        const baseSession = new BaseSession(ws, wsMessageHandler, joiner.getSessionDetails(), this._serializer);
                        resolve(baseSession);
                    } else {
                        ws.send(toSend);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            const closeHandler = () => {
                ws.removeEventListener('message', wsMessageHandler);
                reject(new Error('Connection closed before handshake completed'));
            };

            ws.addEventListener('message', wsMessageHandler);
            ws.addEventListener('error', (error) => reject(error));
            ws.addEventListener('close', closeHandler);
        });
    }
}
