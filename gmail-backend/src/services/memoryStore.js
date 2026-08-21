const usersById = new Map();
const usersByEmail = new Map();
const messagesByKey = new Map();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function userIdForEmail(email) {
  return `memory-user-${Buffer.from(email).toString("hex")}`;
}

export function saveMemoryUser(data) {
  const existingId = usersByEmail.get(data.email);
  const existing = existingId ? usersById.get(existingId) : null;
  const id = existingId || userIdForEmail(data.email);

  const user = {
    ...(existing || {}),
    ...data,
    _id: id,
    refreshToken: data.refreshToken || existing?.refreshToken || "",
  };

  usersById.set(id, user);
  usersByEmail.set(user.email, id);

  return user;
}

export function getMemoryUser(userId) {
  return usersById.get(userId) || null;
}

export function listMemoryMessages(userId) {
  return [...messagesByKey.values()]
    .filter(
      (message) =>
        message.userId === userId &&
        !message.deletedAt
    )
    .sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() -
        new Date(a.receivedAt).getTime()
    );
}

export function listMemoryTrash(userId) {
  purgeExpiredMemoryMessages(userId);

  return [...messagesByKey.values()]
    .filter(
      (message) =>
        message.userId === userId &&
        message.deletedAt
    )
    .sort(
      (a, b) =>
        new Date(b.deletedAt).getTime() -
        new Date(a.deletedAt).getTime()
    );
}

export function saveMemoryMessage(userId, gmailMessageId, data) {
  const key = `${userId}:${gmailMessageId}`;
  const existing = messagesByKey.get(key);
  const message = {
    ...(existing || {}),
    ...data,
    _id:
      existing?._id ||
      `memory-message-${Buffer.from(key).toString("hex")}`,
    gmailMessageId,
    userId,
  };

  messagesByKey.set(key, message);

  return message;
}

export function softDeleteMemoryMessage(userId, id) {
  const message = findMemoryMessage(userId, id);

  if (!message) {
    return null;
  }

  const deletedAt = new Date();

  message.deletedAt = deletedAt;
  message.expiresAt = new Date(
    deletedAt.getTime() + THIRTY_DAYS_MS
  );

  return message;
}

export function softDeleteAllMemoryMessages(userId) {
  const deleted = [];

  for (const message of messagesByKey.values()) {
    if (
      message.userId === userId &&
      !message.deletedAt
    ) {
      const deletedAt = new Date();
      message.deletedAt = deletedAt;
      message.expiresAt = new Date(
        deletedAt.getTime() + THIRTY_DAYS_MS
      );
      deleted.push(message);
    }
  }

  return deleted;
}

export function restoreMemoryMessage(userId, id) {
  const message = findMemoryMessage(userId, id);

  if (!message) {
    return null;
  }

  message.deletedAt = null;
  message.expiresAt = null;

  return message;
}

export function permanentlyDeleteMemoryMessage(userId, id) {
  for (const [key, message] of messagesByKey.entries()) {
    if (
      message.userId === userId &&
      (message._id === id ||
        message.gmailMessageId === id)
    ) {
      messagesByKey.delete(key);
      return message;
    }
  }

  return null;
}

export function findMemoryMessage(userId, id) {
  return (
    [...messagesByKey.values()].find(
      (message) =>
        message.userId === userId &&
        (message._id === id ||
          message.gmailMessageId === id)
    ) || null
  );
}

export function updateMemoryMessage(userId, id, updates) {
  const message = findMemoryMessage(userId, id);

  if (!message) {
    return null;
  }

  Object.assign(message, updates);

  return message;
}

export function purgeExpiredMemoryMessages(userId) {
  const now = Date.now();

  for (const [key, message] of messagesByKey.entries()) {
    if (
      message.userId === userId &&
      message.expiresAt &&
      new Date(message.expiresAt).getTime() <= now
    ) {
      messagesByKey.delete(key);
    }
  }
}
