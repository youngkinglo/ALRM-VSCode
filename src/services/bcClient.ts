import axios, { Method, AxiosResponse } from 'axios';
import { Settings } from './settings';
import { Extension } from '../models/extension';
import { AssignableRange } from '../models/assignableRange';

class Resources {
    public static readonly Extension = 'extensions';
    public static readonly ExtensionObject = 'extensionObjects';
    public static readonly ExtensionObjectField = 'extensionObjectFields';
    public static readonly AssignableRange = 'assignableRanges';
}

interface QueryParameters {
    top?: number;
    skip?: number;
    filter?: string;
}

export class BcClient {
    private baseUrl: string;

    constructor() {
        let settings = new Settings();
        this.validateSettings(settings);

        this.baseUrl = settings.ApiBaseUrl ?? '';

        let authorization: string = Buffer.from(`${settings.ApiUsername}:${settings.ApiPassword}`).toString('base64');
        axios.defaults.validateStatus = (status: number) => status >= 200 && status < 500; // TODO
        axios.defaults.headers.common['Authorization'] = `Basic ${authorization}`;
    }

    private validateSettings(settings: Settings) {
        if (settings.ApiBaseUrl === undefined || settings.ApiUsername === undefined || settings.ApiPassword === undefined)
            throw new Error('Provide api url, name and password in settings!');
    }

    public async getExtension(id: string): Promise<Extension | null> {
        let extensions = await this.readMultiple(Resources.Extension, {
            top: 1,
            filter: `id eq ${id}`
        });

        if (extensions.length === 0)
            return null;

        return Extension.fromJson(extensions[0]);
    }

    public async createExtension(data: Object): Promise<Extension> {
        let extension = await this.create(Resources.Extension, data);

        return Extension.fromJson(extension);
    }

    public async createExtensionObject(extension: Extension, data: Object): Promise<number> {
        let response = await this.callAction(Resources.Extension, extension.id, 'createLine', data);

        let objectId = Number(response);
        if (isNaN(objectId))
            throw new Error(`Unexpected object id response: ${response}`);
        return objectId;
    }

    public async getAllAssignableRanges(): Promise<AssignableRange[]> {
        let assignableRanges = await this.readAll(Resources.AssignableRange);

        return assignableRanges.map(e => AssignableRange.fromJson(e));
    }

    private async read(resource: string, id: string): Promise<Object> {
        let response = await this.sendRequest('GET', this.buildUrl(resource, id));

        if (response.data === null || typeof response.data !== 'object')
            throw new Error(`Unexpected return type: ${typeof response.data}`);

        return response.data;
    }

    private async readMultiple(resource: string, parameters?: QueryParameters): Promise<Object[]> {
        let response = await this.sendRequest('GET', this.buildUrl(resource, undefined, undefined, parameters));

        let x = typeof response.data;
        if (response.data === null || typeof response.data !== 'object')
            throw new Error(`Unexpected return type: ${typeof response.data}`);

        if ('value' in response.data && Array.isArray(response.data['value']))
            return response.data['value'];

        throw new Error(`Unexpected return type: ${typeof response.data['value']}`);
    }

    private async readAll(resource: string, filter?: string): Promise<Object[]> {
        let querySize = 50;
        let offset = 0;

        let result: Object[] = [];
        while (true) {
            let response = await this.readMultiple(
                resource, {
                top: querySize,
                skip: offset,
                filter: filter,
            });

            result.push(...response);
            if (response.length < querySize)
                break;

            offset += querySize;
        }

        return result;
    }

    private async create(resource: string, data: Object): Promise<Object> {
        let response = await this.sendRequest('POST', this.buildUrl(resource), data);

        if (response.data === null || typeof response.data !== 'object')
            throw new Error(`Unexpected return type: ${typeof response.data}`);

        return response.data;
    }

    private async callAction(
        resource: string,
        id: string,
        actionName: string,
        data: Object,
    ): Promise<any> {
        let response = await this.sendRequest('POST', this.buildUrl(resource, id, actionName), data);

        if (response.data === null || typeof response.data !== 'object')
            throw new Error(`Unexpected return type: ${typeof response.data}`);

        if ('value' in response.data)
            return response.data['value'];

        throw new Error(`Unexpected response format:\n${response.data}`);
    }

    private async sendRequest(method: Method, url: string, data?: Object): Promise<AxiosResponse> {
        const response = await axios.request({
            url: url,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
            validateStatus: (status: number) => status >= 200 && status < 500,
        });

        if (response.status >= 200 && response.status < 300)
            return response;

        if (response.data === null)
            throw new Error('Empty response');

        let errorResponse = response.data;
        throw new Error(errorResponse.error);
    }

    private buildUrl(
        resource: string,
        id?: string,
        actionName?: string,
        queryParameters?: QueryParameters,
    ): string {
        let url: string = this.baseUrl;
        if (!url.endsWith('/'))
            url += '/';

        url += resource;
        if (id !== undefined)
            url += `(${id})`;
        if (actionName !== undefined)
            url += `/Microsoft.NAV.${actionName}`;

        if (queryParameters !== undefined) {
            let parameters: string[] = [];
            if (queryParameters.top !== undefined)
                parameters.push(`$top=${queryParameters.top}`);
            if (queryParameters.skip !== undefined)
                parameters.push(`$skip=${queryParameters.skip}`);
            if (queryParameters.filter !== undefined)
                parameters.push(`$filter=${queryParameters.filter}`);

            if (parameters.length !== 0)
                url += '?' + parameters.join('&');
        }

        return url;
    }
}