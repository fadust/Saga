/**
 * Global bridge exports for Saga.
 */

import { LOG_PREFIX } from '../state/constants.js';
import { getState } from '../state/state-manager.js';
import { buildMemo } from '../continuity/memo-builder.js';
import { hasRuntimeAction, listRuntimeActions, runRuntimeAction } from '../runtime/runtime-actions.js';
import { getLastLoreInjectionAudit, getLastLoredeckRetrievalAudit, searchAcceptedLorecards } from '../lorecards/retrieval-audit.js';
import { registerSagaToolManagerTools } from './saga-tool-registry.js';
import { getSagaNamespace, getSagaNamespaceSection } from '../saga-namespace.js';
import { querySemanticCanon, semanticCanonStatus } from '../context/semantic-canon.js';

const LEGACY_GLOBAL_BRIDGE_KEYS = Object.freeze([
    '_sagaBuildMemo',
    '_sagaRefreshUI',
    '_sagaGetState',
    '_sagaShowLorePanel',
    '_sagaHideLorePanel',
    '_sagaRefreshLorePanel',
    '_sagaRunAction',
    '_sagaListActions',
    '_sagaGetLastLoreInjectionAudit',
    '_sagaGetLastLoredeckRetrievalAudit',
    '_sagaSearchLorecards',
    '_sagaRegisterToolManagerTools',
]);

let exposedBridge = null;
let exposedActions = null;

function clearLegacyGlobalBridgeAliases() {
    for (const key of LEGACY_GLOBAL_BRIDGE_KEYS) {
        delete globalThis[key];
    }
}

export function exposeGlobalBridge() {
    const sagaNamespace = getSagaNamespace();
    exposedActions = {
        has: hasRuntimeAction,
        list: listRuntimeActions,
        run: runRuntimeAction,
    };
    sagaNamespace.actions = exposedActions;

    exposedBridge = getSagaNamespaceSection('bridge');
    Object.assign(exposedBridge, {
        buildMemo,
        refreshUI: () => runRuntimeAction('ui.refresh'),
        getState,
        showRuntime: () => runRuntimeAction('runtime.show'),
        hideRuntime: () => runRuntimeAction('runtime.hide'),
        refreshRuntime: () => runRuntimeAction('runtime.refresh'),
        runAction: runRuntimeAction,
        listActions: listRuntimeActions,
        getLastLoreInjectionAudit,
        getLastLoredeckRetrievalAudit,
        searchLorecards: (query, options = {}) => searchAcceptedLorecards(getState(), query, options),
        registerToolManagerTools: registerSagaToolManagerTools,
        queryCanon: querySemanticCanon,
        canonStatus: semanticCanonStatus,
    });
    clearLegacyGlobalBridgeAliases();
    console.log(`${LOG_PREFIX} Global bridge exposed`);
}

export function removeGlobalBridge() {
    const sagaNamespace = globalThis.Saga;
    if (sagaNamespace && typeof sagaNamespace === 'object') {
        if (sagaNamespace.bridge === exposedBridge) delete sagaNamespace.bridge;
        if (sagaNamespace.actions === exposedActions) delete sagaNamespace.actions;
    }
    exposedBridge = null;
    exposedActions = null;
    clearLegacyGlobalBridgeAliases();
}
