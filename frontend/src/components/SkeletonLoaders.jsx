import React from "react";

// Skeleton for the answer section
export const AnswerSkeleton = () => {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-4 sm:p-6 border border-zinc-700/50 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-3/4"></div>
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-full"></div>
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-5/6"></div>
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-full"></div>
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-4/5"></div>
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-full"></div>
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-3/4"></div>
        <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-5/6"></div>
      </div>
    </div>
  );
};

// Skeleton for PDF references
export const PDFReferencesSkeleton = () => {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 overflow-x-auto animate-pulse">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="text-left border-b border-zinc-700/50">
            <th className="pb-3">
              <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-24"></div>
            </th>
            <th className="pb-3">
              <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-16"></div>
            </th>
          </tr>
        </thead>
        <tbody>
          {[...Array(3)].map((_, index) => (
            <tr key={index} className="border-b border-zinc-700/30">
              <td className="py-3">
                <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-48"></div>
              </td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  {[...Array(Math.floor(Math.random() * 3) + 1)].map((_, i) => (
                    <div
                      key={i}
                      className="px-3 py-1 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded-md w-8 h-6"
                    ></div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Skeleton for related queries
export const RelatedQueriesSkeleton = () => {
  return (
    <div className="border-b border-zinc-700/50 w-full animate-pulse">
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className="w-full flex flex-between items-center pt-3 pb-3 border-t border-zinc-700/30"
        >
          <div className="text-left w-full">
            <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-3/4 mb-1"></div>
            {Math.random() > 0.5 && (
              <div className="h-3 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-1/2"></div>
            )}
          </div>
          <div className="w-4 h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded-full"></div>
        </div>
      ))}
    </div>
  );
};

// Skeleton for online links
export const OnlineLinksSkeleton = () => {
  return (
    <div className="w-full mt-2 mb-3 overflow-x-auto flex flex-row justify-start gap-2 rounded-lg pb-2 animate-pulse">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-2 bg-zinc-800/50 text-zinc-200 px-3 py-2 rounded-lg border border-zinc-700/50 whitespace-nowrap"
        >
          <div className="w-5 h-5 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded-full"></div>
          <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-24"></div>
        </div>
      ))}
    </div>
  );
};

// Skeleton for images
export const ImagesSkeleton = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
      {[...Array(4)].map((_, index) => (
        <div
          key={index}
          className="relative aspect-video bg-gradient-to-br from-zinc-800/50 to-zinc-700/50 rounded-lg"
        ></div>
      ))}
    </div>
  );
};

// Skeleton for videos
export const VideosSkeleton = () => {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[...Array(2)].map((_, index) => (
        <div
          key={index}
          className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden border border-zinc-700/50 bg-gradient-to-br from-zinc-800/50 to-zinc-700/50"
        ></div>
      ))}
    </div>
  );
};

// Main query result skeleton that combines all the above
export const QueryResultSkeleton = () => {
  return (
    <div className="flex w-full font-raleway flex-col sm:flex-row justify-between mb-4 border-b border-zinc-800/50 pb-8">
      <div className="h-full w-full sm:w-3/4">
        {/* Query title skeleton */}
        <div className="h-8 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-3/4 mb-4 mt-4"></div>

        {/* Answer header skeleton */}
        <div className="mb-2 rounded-t-2xl mt-2 flex justify-start items-center gap-2">
          <div className="w-5 h-5 bg-blue-400/50 rounded-full"></div>
          <div className="h-5 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-16"></div>
        </div>

        {/* Online links skeleton - simplified */}
        <div className="w-full mt-2 mb-3 overflow-x-auto flex flex-row justify-start gap-2 rounded-lg pb-2">
          {[...Array(2)].map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-zinc-800/50 text-zinc-200 px-3 py-2 rounded-lg border border-zinc-700/50 whitespace-nowrap"
            >
              <div className="w-5 h-5 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded-full"></div>
              <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-24"></div>
            </div>
          ))}
        </div>

        {/* Answer content skeleton - simplified */}
        <div className="bg-zinc-800/50 rounded-lg p-4 sm:p-6 border border-zinc-700/50">
          <div className="space-y-3">
            <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-3/4"></div>
            <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-full"></div>
            <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-5/6"></div>
            <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-full"></div>
          </div>
        </div>

        {/* References section skeleton - simplified */}
        <div className="mt-6">
          <div className="mb-2 text-md flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-400/50 rounded-full"></div>
            <div className="h-5 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-24"></div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-left border-b border-zinc-700/50">
                  <th className="pb-3">
                    <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-24"></div>
                  </th>
                  <th className="pb-3">
                    <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-16"></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(2)].map((_, index) => (
                  <tr key={index} className="border-b border-zinc-700/30">
                    <td className="py-3">
                      <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-48"></div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded-md w-8 h-6"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right sidebar - simplified */}
      <div className="w-full sm:w-1/4 p-3 gap-3 flex flex-col justify-start mt-4 sm:mt-0">
        <div className="border text-sm flex items-center justify-center gap-2 border-zinc-700/50 rounded-lg p-2 bg-zinc-800/50">
          <div className="h-4 bg-gradient-to-r from-zinc-700/70 to-zinc-600/70 rounded w-24"></div>
          <div className="w-4 h-4 bg-blue-400/50 rounded-full"></div>
        </div>

        {/* Images skeleton - simplified */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(2)].map((_, index) => (
            <div
              key={index}
              className="relative aspect-video bg-gradient-to-br from-zinc-800/50 to-zinc-700/50 rounded-lg"
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};
