import React from "react";
import { FaPaperPlane } from "react-icons/fa";

const defaultQueries = [
  "What are the key safety regulations for construction sites?",
  "How to ensure workplace compliance with OSHA standards?",
  "What are the requirements for fall protection equipment?",
  "How to implement proper safety training programs?",
  "What are the latest updates in workplace safety regulations?",
  "How to maintain compliance documentation effectively?",
  "What are the best practices for hazard communication?",
  "How to conduct proper safety inspections?",
  "What documentation is required for regulatory compliance?",
  "How do different industries approach safety management?",
  "What are common challenges when implementing safety protocols?",
  "How does compliance impact risk management?",
];

const RelevantDefaultQueries = ({ onQuerySelect }) => {
  return (
    <div className="mt-8 w-full max-w-4xl px-4">
      <div className="relative">
        <div className="h-32 overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-1 gap-3">
            {defaultQueries.map((query, index) => (
              <button
                key={index}
                onClick={() => onQuerySelect(query)}
                className="w-full text-left p-2 sm:p-3 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg border border-zinc-700/50 hover:border-blue-400/30 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base text-zinc-300 group-hover:text-blue-400 transition-colors duration-300">
                    {query}
                  </span>
                  <FaPaperPlane className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};

export default RelevantDefaultQueries;
