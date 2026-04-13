export interface ExperimentAssignment {
    id: string;
    user_id: string;
    experiment_name: string;
    variant: string;
    assigned_at: Date;
}
export interface ExperimentConfig {
    name: string;
    variants: string[];
    weights?: number[];
}
declare class ExperimentService {
    private static instance;
    private constructor();
    static getInstance(): ExperimentService;
    assignUserToExperiment(userId: string, experimentName: string): Promise<string>;
    getUserVariant(userId: string, experimentName: string): Promise<string | null>;
    getExperimentConfig(experimentName: string): ExperimentConfig | null;
    getAllExperiments(): ExperimentConfig[];
    getExperimentStats(experimentName: string): Promise<Record<string, number>>;
}
export declare const experimentService: ExperimentService;
export declare function getExperimentVariant(userId: string, experimentName: string, defaultVariant?: string): Promise<string>;
export {};
//# sourceMappingURL=experiment.service.d.ts.map