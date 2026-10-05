import { Simulation, simulationCompatibility } from "@thy-will/simulation";

// Authoritative session hosting is implemented in later steps.
export const gameServerCompatibility = simulationCompatibility;

// Local headless session factory; network hosting remains a later milestone.
export function createSimulationSession(): Simulation { return new Simulation(); }
