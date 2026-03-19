import { useState } from 'react';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const STEPS = [
  { label: 'Bóc tách', icon: '1' },
  { label: 'Layout', icon: '2' },
  { label: 'Nội dung', icon: '3' },
  { label: 'Hoàn thành', icon: '4' },
];

export default function StepWizard({ currentStep, onStepChange, canProceed, children }) {
  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center">
              <button
                onClick={() => i < currentStep && onStepChange(i)}
                disabled={i > currentStep}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  i === currentStep
                    ? 'text-primary'
                    : i < currentStep
                    ? 'text-green-500 cursor-pointer hover:text-green-400'
                    : 'text-muted-foreground opacity-50'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                  i === currentStep
                    ? 'border-primary bg-primary/20 text-primary'
                    : i < currentStep
                    ? 'border-green-500 bg-green-500/20 text-green-500'
                    : 'border-muted-foreground/30 text-muted-foreground'
                }`}>
                  {i < currentStep ? <Check className="w-3 h-3" /> : step.icon}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className={`w-4 h-4 mx-1 ${i < currentStep ? 'text-green-500' : 'text-muted-foreground/30'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
