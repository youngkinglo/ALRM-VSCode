import { readAppJson, getCurrentWorkspaceUri } from "../services/fileService";
import { ExtensionService } from "../services/extensionService";
import { showInformationMessage, showErrorMessage, getUserSelection } from "../helpers/userInteraction";
import { Extension } from "../models/extension";
import { App } from '../models/app';

export async function InitiliazeCommand() {
    let workspaceUri = getCurrentWorkspaceUri();

    // 1. find app.json
    let app: App;
    try {
        app = readAppJson(workspaceUri);
        if (app === null || app.id === '')
            throw new Error('Valid app.json not found!');
    }
    catch (error) {
        showErrorMessage(error);
        return;
    }

    let service = new ExtensionService();
    // 2. query api, extension may already exist
    let extension = await service.getExtension(workspaceUri);
    if (extension !== null) {
        showInformationMessage(`Existing extension ${extension.code} found!`);
        // XXX at this point we could ask the user if they want to synchronize?

        return;
    }

    // XXX add range min/max to API
    let assignableRanges = await service.getAllAssignableRanges();
    // XXX then edit app.json ranges

    let range = await getUserSelection(assignableRanges.map(e => e.code));
    if (range === undefined)
        return; // canceled

    try {
        let extension: Extension = await service.createExtension(workspaceUri, app.id,
            {
                id: app.id,
                rangeCode: range,
                name: app.name.substring(0, 50),
                description: app.description.substr(0, 250),
            });

        showInformationMessage(`Successfully initialized extension ${extension.code}!`);
    } catch (error) {
        showErrorMessage(error);
    }
}
