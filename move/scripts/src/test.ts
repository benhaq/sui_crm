import { Transaction } from "@mysten/sui/transactions";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SealClient, SessionKey, getAllowlistedKeyServers } from "@mysten/seal"; // Ensure @mysten/seal is installed
import { fromHEX, toHEX } from "@mysten/bcs"; // For handling hex strings if needed for IDs
import { packageId, whitelistId } from "./constant";

// --- Configuration (MUST REPLACE with your actual values) ---
const PACKAGE_ID = packageId; // Your main package ID where employee_log and whitelist are
const MODULE_WHITELIST = "whitelist"; // Module where create_whitelist is
const MODULE_EMPLOYEE_LOG = "employee_log"; // Module with seal_approve_daily_access, check_in/out
const SUI_NODE_URL = getFullnodeUrl("testnet"); // Or 'devnet', 'mainnet'

// Replace with your employee's keypair (ensure it has SUI for gas)
const employeeMnemonic = "employee secret recovery phrase here";
const employeeKeypair = Ed25519Keypair.deriveKeypair(employeeMnemonic);
const employeeAddress = employeeKeypair.getPublicKey().toSuiAddress();

// Mysten Labs Testnet Key Server Object IDs (replace if you use others or if these change)
// You need to find the actual Object IDs for these on Testnet.
// These are illustrative placeholders.
const KEY_SERVER_OBJECT_IDS_TESTNET = getAllowlistedKeyServers("testnet");
const ENCRYPTION_THRESHOLD = 2; // Example: 1-out-of-2 key servers needed

const CLOCK_OBJECT_ID = "0x6"; // Standard shared Clock object ID
// --- End Configuration ---

// Helper to create a daily ID for Seal policy
function createDailyEmployeeId(employeeAddr: string): string {
  const date = new Date();
  const dateString = `${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()}`;
  const encoder = new TextEncoder();
  // Combine employee address and date string for a unique daily ID
  // Using toHEX and fromHEX for consistent byte representation if needed, or just use strings
  const idData = encoder.encode(`${employeeAddr}_${dateString}_daily_access`);
  console.log(
    `Generated Seal ID for policy: ${employeeAddr}_${dateString}_daily_access`
  );
  return toHEX(idData);
}
// export interface KeyServerConfig {
//   objectId: string;
//   weight: number;
//   apiKeyName?: string;
//   apiKey?: string;
// }
async function runEmployeeCheckInCheckOutFlow() {
  const suiClient = new SuiClient({ url: SUI_NODE_URL });
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: getAllowlistedKeyServers("testnet").map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false, // Set to true in production/first setup
  });

  console.log(`Employee Address: ${employeeAddress}`);
  console.log(`Package ID: ${PACKAGE_ID}`);
  console.log(
    `Using Seal Key Servers: ${KEY_SERVER_OBJECT_IDS_TESTNET.join(", ")}`
  );

  let whitelistObjectId = whitelistId;
  let dailyAccessCiphertext: Uint8Array | undefined; // Encrypted "daily pass"
  let sessionKey: SessionKey | undefined;

  try {
    // --- STAGE 2: Employee Activates Daily Access Pass (using Seal) ---
    console.log("\n--- Stage 2: Employee Activating Daily Access Pass ---");
    if (!whitelistObjectId)
      throw new Error("Whitelist ID not found for daily pass activation.");

    sessionKey = new SessionKey({
      address: employeeAddress,
      packageId: PACKAGE_ID, // Package ID where seal_approve_daily_access is
      ttlMin: 24 * 60, // 1 day
      suiClient: suiClient,
    });
    const personalMessage = sessionKey.getPersonalMessage();
    console.log(
      "Please sign this message in your wallet to activate the session key for Seal:"
    );
    console.log(toHEX(personalMessage)); // Show what needs to be signed

    const { signature: signedPersonalMessage } =
      await employeeKeypair.signPersonalMessage(personalMessage);
    sessionKey.setPersonalMessageSignature(signedPersonalMessage);
    console.log("SessionKey initialized and signed.");

    const employeePolicyId = createDailyEmployeeId(employeeAddress); // Unique ID for the policy
    const dataToEncrypt = new Uint8Array([1]); // Dummy data representing "access granted"

    const { encryptedObject } = await sealClient.encrypt({
      threshold: ENCRYPTION_THRESHOLD,
      packageId: PACKAGE_ID,
      id: employeePolicyId, // The ID for the specific policy
      data: dataToEncrypt,
      // sessionKey: sessionKey, // Pass sessionKey here if encrypt also needs it for some flows, or not if encrypt is purely based on public keys.
      // The SealClient typically uses server public keys for encryption. SessionKey is mainly for decryption.
      // For encrypt, we don't need a tx or sessionKey in this context.
      // The `id` links it to the approval function.
    });
    dailyAccessCiphertext = encryptedObject;
    console.log("Daily access encrypted token created (ciphertext stored).");
    // console.log('Backup symmetric key (for disaster recovery, keep secret):', toHEX(backupKey));

    // --- STAGE 3: Employee Performs Check-In ---
    console.log("\n--- Stage 3: Employee Performing Check-In ---");
    if (!dailyAccessCiphertext)
      throw new Error("Daily access ciphertext not available.");
    if (!sessionKey) throw new Error("SessionKey not initialized.");
    if (!whitelistObjectId)
      throw new Error("Whitelist ID not available for check-in.");

    // Get the key request object id
    const txbRequestCheckIn = new Transaction();
    txbRequestCheckIn.moveCall({
      target: `${PACKAGE_ID}::employee_log::request_check_in`,
      arguments: [
        txbRequestCheckIn.object(whitelistObjectId),
        txbRequestCheckIn.object("0x6"),
      ],
    });
    const result = await suiClient.signAndExecuteTransaction({
      transaction: txbRequestCheckIn,
      signer: employeeKeypair,
      options: { showEffects: true, showEvents: true },
    });
    const krInId = result.effects!.created![0].reference.objectId;

    console.log("krInId", krInId);

    // 3a. Seal Approval for Check-In
    const txbSealApproveCheckIn = new Transaction();
    const sealApproveTarget =
      `${PACKAGE_ID}::${MODULE_WHITELIST}::seal_approve` as `${string}::${string}::${string}`;
    txbSealApproveCheckIn.moveCall({
      target: sealApproveTarget,
      arguments: [
        txbSealApproveCheckIn.object(whitelistObjectId),
        txbSealApproveCheckIn.object(krInId),
        txbSealApproveCheckIn.object(CLOCK_OBJECT_ID),
        // Add other args as defined in your seal_approve_daily_access
      ],
    });
    const sealApproveTxBytes = await txbSealApproveCheckIn.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    console.log(
      "Attempting Seal decryption to verify daily access for check-in..."
    );
    const decryptedPayload = await sealClient.decrypt({
      data: dailyAccessCiphertext,
      sessionKey: sessionKey,
      txBytes: sealApproveTxBytes,
    });

    if (decryptedPayload && decryptedPayload[0] === 1) {
      console.log("Seal daily access approved for check-in!");

      // 3b. Actual Check-In Transaction
      const txbCheckIn = new Transaction();
      const requestTarget =
        `${PACKAGE_ID}::${MODULE_EMPLOYEE_LOG}::request_check_in` as `${string}::${string}::${string}`;
      const [keyProofObj] = txbCheckIn.moveCall({
        target: requestTarget,
        arguments: [
          txbCheckIn.object(whitelistObjectId),
          txbCheckIn.object(CLOCK_OBJECT_ID),
        ],
      });

      const checkInTarget =
        `${PACKAGE_ID}::${MODULE_EMPLOYEE_LOG}::check_in` as `${string}::${string}::${string}`;
      txbCheckIn.moveCall({
        target: checkInTarget,
        arguments: [
          keyProofObj,
          txbCheckIn.object(whitelistObjectId),
          txbCheckIn.object(CLOCK_OBJECT_ID),
        ],
      });

      console.log("Submitting actual check-in transaction...");
      const checkInResult = await suiClient.signAndExecuteTransaction({
        signer: employeeKeypair,
        transaction: txbCheckIn,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });
      console.log("Check-In Transaction Digest:", checkInResult.digest);
      // Parse checkInResult for created EmployeeLog object, etc.
      const employeeLogChange = checkInResult.objectChanges?.find(
        (change) =>
          change.type === "created" &&
          change.objectType.startsWith(
            `${PACKAGE_ID}::${MODULE_EMPLOYEE_LOG}::EmployeeLog`
          )
      );
      if (employeeLogChange && "objectId" in employeeLogChange) {
        console.log(
          "EmployeeLog created/updated with ID:",
          employeeLogChange.objectId
        );
      }
    } else {
      console.error("Seal daily access DENIED for check-in.");
    }

    // --- STAGE 4: Employee Performs Check-Out (similar to Check-In) ---
    // For brevity, this stage would mirror Stage 3 but call request_check_out and check_out.
    // It would re-use the same dailyAccessCiphertext and active sessionKey (if within TTL).
    // The seal_approve_daily_access would be called again.
    console.log(
      "\n--- Stage 4: Employee Performing Check-Out (Conceptual) ---"
    );
    console.log(
      "Check-out would follow a similar pattern to check-in, using Seal for approval."
    );
  } catch (error) {
    console.error("Error in employee check-in/out flow:", error);
    if (error instanceof Error && "message" in error) {
      console.error("Error Message:", error.message);
      if ((error as any).cause) {
        console.error("Cause:", (error as any).cause);
      }
    }
    if (typeof error === "object" && error !== null && "logs" in error) {
      console.error(
        "Transaction Logs (if available from error):",
        (error as any).logs
      );
    }
  }
}

runEmployeeCheckInCheckOutFlow();
