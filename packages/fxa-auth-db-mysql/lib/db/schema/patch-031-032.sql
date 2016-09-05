-- Update deleteAccount to remove accountUnlockCodes
CREATE PROCEDURE `deleteAccount_9` (
  IN `uidArg` BINARY(16)
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  DELETE FROM sessionTokens WHERE uid = uidArg;
  DELETE FROM keyFetchTokens WHERE uid = uidArg;
  DELETE FROM accountResetTokens WHERE uid = uidArg;
  DELETE FROM passwordChangeTokens WHERE uid = uidArg;
  DELETE FROM passwordForgotTokens WHERE uid = uidArg;
  DELETE FROM accounts WHERE uid = uidArg;
  DELETE FROM devices WHERE uid = uidArg;
  DELETE FROM unverifiedTokens WHERE uid = uidArg;

  INSERT INTO eventLog(
    uid,
    typ,
    iat
  )
  VALUES(
    uidArg,
    "delete",
    UNIX_TIMESTAMP()
  );

  COMMIT;
END;

-- Updated to not set lockedAt since it's no longer used.
CREATE PROCEDURE `forgotPasswordVerified_5` (
    IN `inPasswordForgotTokenId` BINARY(32),
    IN `inAccountResetTokenId` BINARY(32),
    IN `inTokenData` BINARY(32),
    IN `inUid` BINARY(16),
    IN `inCreatedAt` BIGINT UNSIGNED
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        -- ERROR
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Since we only ever want one accountResetToken per uid, then we
    -- do a replace - generally due to a collision on the unique uid field.
    REPLACE INTO accountResetTokens(
        tokenId,
        tokenData,
        uid,
        createdAt
    )
    VALUES(
        inAccountResetTokenId,
        inTokenData,
        inUid,
        inCreatedAt
    );

    DELETE FROM passwordForgotTokens WHERE tokenId = inPasswordForgotTokenId;

    DELETE FROM accountUnlockCodes WHERE uid = inUid;

    UPDATE accounts SET emailVerified = true WHERE uid = inUid;

    COMMIT;
END;


DROP TABLE accountUnlockCodes;

-- Schema patch-level increment.
UPDATE dbMetadata SET value = '32' WHERE name = 'schema-patch-level';
