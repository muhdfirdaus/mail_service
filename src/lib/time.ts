export const NOT_DELETED_MS = -62135596800000; // matches your sentinel
export const NOT_DELETED_DATE = new Date(NOT_DELETED_MS);

export function newCreateTimes() {
  const now = new Date();
  return {
    create_time: now,
    update_time: now,
    delete_time: NOT_DELETED_DATE
  };
}
