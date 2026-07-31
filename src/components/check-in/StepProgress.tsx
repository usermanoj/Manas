interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function StepProgress({ currentStep, totalSteps }: StepProgressProps): React.ReactNode {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div data-testid="step-progress" className="mb-6" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-text-muted">{percentage}%</span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
