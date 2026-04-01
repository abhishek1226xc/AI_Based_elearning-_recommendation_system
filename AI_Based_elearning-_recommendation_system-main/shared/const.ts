export const COOKIE_NAME = "app_session_id";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_IN_YEAR = 365;

export const ONE_YEAR_MS = DAY_MS * DAYS_IN_YEAR;
export const AXIOS_TIMEOUT_MS = 30_000;

const UNAUTHORIZED_ERROR_CODE = "10001";
const FORBIDDEN_ERROR_CODE = "10002";

export const UNAUTHED_ERR_MSG = `Please login (${UNAUTHORIZED_ERROR_CODE})`;
export const NOT_ADMIN_ERR_MSG = `You do not have required permission (${FORBIDDEN_ERROR_CODE})`;
