import {
    FinancialPartner,
    ProviderAuthConfig,
    ProviderCallbackConfig,
    ProviderRegistryConfig,
    RestEndpointConfig,
} from '../../../types.js';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const PARTNER_TYPES = new Set(['mobile_money', 'bank', 'card', 'crypto']);
const LOGIC_TYPES = new Set(['REGISTRY', 'GENERIC_REST', 'SPECIALIZED']);

function assertObject(value: any, label: string): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label}_INVALID`);
    }
    return value as Record<string, any>;
}

function normalizeMethod(method: unknown, label: string): RestEndpointConfig['method'] {
    const normalized = String(method || '').trim().toUpperCase();
    if (!HTTP_METHODS.has(normalized)) {
        throw new Error(`${label}_METHOD_INVALID`);
    }
    return normalized as RestEndpointConfig['method'];
}

function validatePathLike(url: unknown, label: string): string {
    const value = String(url || '').trim();
    if (!value) {
        throw new Error(`${label}_URL_MISSING`);
    }
    if (!/^https?:\/\//i.test(value) && !value.startsWith('/')) {
        throw new Error(`${label}_URL_INVALID`);
    }
    return value;
}

function normalizeHeaders(headers: unknown, label: string): Record<string, string> | undefined {
    if (headers === undefined || headers === null) return undefined;
    const raw = assertObject(headers, `${label}_HEADERS`);
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
        normalized[String(key)] = String(value);
    }
    return normalized;
}

function normalizePayloadTemplate(payload: unknown, label: string): Record<string, any> | undefined {
    if (payload === undefined || payload === null) return undefined;
    return assertObject(payload, `${label}_PAYLOAD_TEMPLATE`);
}

function normalizeResponseMapping(mapping: unknown, label: string): RestEndpointConfig['response_mapping'] | undefined {
    if (mapping === undefined || mapping === null) return undefined;
    const raw = assertObject(mapping, `${label}_RESPONSE_MAPPING`);
    const normalized: NonNullable<RestEndpointConfig['response_mapping']> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (value !== undefined && value !== null && String(value).trim().length > 0) {
            normalized[key as keyof typeof normalized] = String(value);
        }
    }
    return normalized;
}

function normalizeEndpointConfig(
    config: unknown,
    label: string,
): RestEndpointConfig | undefined {
    if (config === undefined || config === null) return undefined;
    const raw = assertObject(config, label);
    return {
        url: validatePathLike(raw.url, label),
        method: normalizeMethod(raw.method || 'POST', label),
        headers: normalizeHeaders(raw.headers, label),
        payload_template: normalizePayloadTemplate(raw.payload_template, label),
        response_mapping: normalizeResponseMapping(raw.response_mapping, label),
    };
}

function normalizeAuthConfig(config: unknown): ProviderAuthConfig | undefined {
    if (config === undefined || config === null) return undefined;
    const raw = assertObject(config, 'PROVIDER_AUTH');
    const type = String(raw.type || 'api_key').trim().toLowerCase();
    if (!['oauth2_client_credentials', 'api_key', 'static_token', 'none'].includes(type)) {
        throw new Error('PROVIDER_AUTH_TYPE_INVALID');
    }
    const endpoint = normalizeEndpointConfig({
        url: raw.url || '/oauth/token',
        method: raw.method || 'POST',
        headers: raw.headers,
        payload_template: raw.payload_template,
        response_mapping: raw.response_mapping,
    }, 'PROVIDER_AUTH');
    if (!endpoint) {
        throw new Error('PROVIDER_AUTH_INVALID');
    }
    return {
        ...endpoint,
        type: type as ProviderAuthConfig['type'],
        cache_ttl_seconds:
            raw.cache_ttl_seconds === undefined || raw.cache_ttl_seconds === null
                ? undefined
                : Number(raw.cache_ttl_seconds),
    };
}

function normalizeValues(values: unknown): Array<string | number> | undefined {
    if (!Array.isArray(values)) return undefined;
    return values
        .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
        .map((value) => typeof value === 'number' ? value : String(value));
}

function normalizeCallbackConfig(config: unknown): ProviderCallbackConfig | undefined {
    if (config === undefined || config === null) return undefined;
    const raw = assertObject(config, 'PROVIDER_CALLBACK');
    return {
        reference_field: raw.reference_field ? String(raw.reference_field) : undefined,
        status_field: raw.status_field ? String(raw.status_field) : undefined,
        message_field: raw.message_field ? String(raw.message_field) : undefined,
        event_id_field: raw.event_id_field ? String(raw.event_id_field) : undefined,
        success_values: normalizeValues(raw.success_values),
        pending_values: normalizeValues(raw.pending_values),
        failed_values: normalizeValues(raw.failed_values),
        completed_values: normalizeValues(raw.completed_values),
    };
}

export function normalizeProviderRegistryConfig(config: unknown): ProviderRegistryConfig {
    const raw = assertObject(config || {}, 'PROVIDER_REGISTRY');
    const normalized: ProviderRegistryConfig = {
        auth: normalizeAuthConfig(raw.auth),
        endpoint: raw.endpoint ? String(raw.endpoint) : undefined,
        method: raw.method ? normalizeMethod(raw.method, 'PROVIDER_REGISTRY') : undefined,
        headers: normalizeHeaders(raw.headers, 'PROVIDER_REGISTRY'),
        payload_template: normalizePayloadTemplate(raw.payload_template, 'PROVIDER_REGISTRY'),
        response_mapping: normalizeResponseMapping(raw.response_mapping, 'PROVIDER_REGISTRY'),
        stk_push: normalizeEndpointConfig(raw.stk_push, 'PROVIDER_STK_PUSH'),
        disbursement: normalizeEndpointConfig(raw.disbursement, 'PROVIDER_DISBURSEMENT'),
        check_status: normalizeEndpointConfig(raw.check_status, 'PROVIDER_CHECK_STATUS'),
        balance: normalizeEndpointConfig(raw.balance, 'PROVIDER_BALANCE'),
        callback: normalizeCallbackConfig(raw.callback),
    };

    const hasOperations = Boolean(
        normalized.stk_push ||
            normalized.disbursement ||
            normalized.balance ||
            normalized.check_status ||
            normalized.callback,
    );
    if (!hasOperations) {
        throw new Error('PROVIDER_REGISTRY_OPERATION_MISSING');
    }
    return normalized;
}

export function normalizePartnerType(type: unknown): FinancialPartner['type'] {
    const normalized = String(type || '').trim().toLowerCase();
    if (!PARTNER_TYPES.has(normalized)) {
        throw new Error('PROVIDER_TYPE_INVALID');
    }
    return normalized as FinancialPartner['type'];
}

export function normalizeLogicType(logicType: unknown): FinancialPartner['logic_type'] {
    const normalized = String(logicType || 'REGISTRY').trim().toUpperCase();
    if (!LOGIC_TYPES.has(normalized)) {
        throw new Error('PROVIDER_LOGIC_TYPE_INVALID');
    }
    return normalized as FinancialPartner['logic_type'];
}

export function normalizeFinancialPartnerInput(
    payload: Partial<FinancialPartner>,
    mode: 'create' | 'update' = 'create',
): Partial<FinancialPartner> {
    const normalized: Partial<FinancialPartner> = { ...payload };

    if (payload.type !== undefined || mode === 'create') {
        normalized.type = normalizePartnerType(payload.type);
    }

    if (payload.logic_type !== undefined || mode === 'create') {
        normalized.logic_type = normalizeLogicType(payload.logic_type);
    }

    if (payload.name !== undefined || mode === 'create') {
        const name = String(payload.name || '').trim();
        if (!name) throw new Error('PROVIDER_NAME_MISSING');
        normalized.name = name;
    }

    if (payload.api_base_url !== undefined) {
        normalized.api_base_url = String(payload.api_base_url || '').trim() || undefined;
    }

    if (payload.status !== undefined) {
        normalized.status = String(payload.status).trim().toUpperCase() as FinancialPartner['status'];
    }

    if (payload.mapping_config !== undefined || mode === 'create') {
        normalized.mapping_config = normalizeProviderRegistryConfig(payload.mapping_config || {});
    }

    return normalized;
}
