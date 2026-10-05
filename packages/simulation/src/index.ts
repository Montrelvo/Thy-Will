import { CONTENT_VERSION } from "@thy-will/content";
import { PROTOCOL_VERSION } from "@thy-will/protocol";

// A headless build boundary; gameplay starts in Step 3.
export const simulationCompatibility = Object.freeze({
  contentVersion: CONTENT_VERSION,
  protocolVersion: PROTOCOL_VERSION,
});
