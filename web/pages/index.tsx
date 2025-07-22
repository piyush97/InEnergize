import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            InErgize
          </h1>
          <h2 className="text-xl text-gray-600 mb-8">
            LinkedIn Profile Optimization Platform
          </h2>
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="text-sm text-gray-500">
                  🚧 Platform under development
                </div>
              </div>
              <div className="text-center text-sm text-gray-600">
                Full implementation coming in Phase 1
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;