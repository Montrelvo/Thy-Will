import { simulationCompatibility } from "@thy-will/simulation";

// Babylon presentation is implemented in Step 2.
export const clientCompatibility = simulationCompatibility;

export { FIREBASE_WEB_SDK_VERSION, readFirebaseConfiguration } from './cloud/firebase.js';
export type { FirebaseBrowserConfig, FirebaseEnvironment, FirebaseIdentityState } from './cloud/firebase.js';
