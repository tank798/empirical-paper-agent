export type ApiErrorPayload = {
  type: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  error: null;
};

export type ApiFailure = {
  success: false;
  data: null;
  error: ApiErrorPayload;
};

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data, error: null };
}

export function fail(error: ApiErrorPayload): ApiFailure {
  return { success: false, data: null, error };
}
