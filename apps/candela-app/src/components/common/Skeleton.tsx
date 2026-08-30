import React from 'react';

export function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-gray-200/80 rounded-xl ${className}`}
      {...props}
    />
  );
}

export function ModuleCardSkeleton() {
  return (
    <div className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm border border-gray-100 p-6 flex flex-col justify-between animate-pulse">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-200" />
      <div className="pt-1">
        <div className="h-6 w-36 bg-gray-200 rounded-lg mb-2.5" />
        <div className="h-3 w-48 bg-gray-100 rounded-md mb-1.5" />
        <div className="h-3 w-32 bg-gray-100 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-3">
        <div className="h-4 w-20 bg-gray-100 rounded-full" />
        <div className="h-4 w-14 bg-gray-100 rounded-md" />
      </div>
    </div>
  );
}

export function LevelCardSkeleton() {
  return (
    <div className="h-[160px] w-full rounded-[16px] bg-white shadow-md border-2 border-transparent p-6 flex flex-col justify-center items-center gap-3 animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded-xl" />
      <div className="h-3 w-24 bg-gray-100 rounded-md" />
    </div>
  );
}

export function GeoboardCardSkeleton() {
  return (
    <div className="relative overflow-hidden min-h-[190px] w-full rounded-[22px] bg-white shadow-sm border border-gray-100 p-6 flex flex-col justify-between animate-pulse">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-200" />
      <div className="pt-1">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gray-200 shrink-0" />
          <div className="h-6 w-36 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-3.5 w-full bg-gray-100 rounded-md mb-2" />
        <div className="h-3 w-3/4 bg-gray-100 rounded-md" />
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
        <div className="h-4 w-16 bg-gray-100 rounded-md" />
      </div>
    </div>
  );
}

export function PatientDashboardSkeleton() {
  return (
    <div className="w-full flex-1 flex flex-col">
      {/* Header bar skeleton */}
      <div className="max-w-6xl mx-auto w-full px-8 pt-8 pb-2 flex items-center justify-between">
        <div>
          <div className="h-8 w-44 bg-gray-200 rounded-xl mb-2 animate-pulse" />
          <div className="h-4 w-60 bg-gray-100 rounded-md animate-pulse" />
        </div>
        <div className="h-10 w-28 bg-gray-200 rounded-xl animate-pulse" />
      </div>

      {/* Grid of family cards */}
      <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
        <ModuleCardSkeleton />
        <ModuleCardSkeleton />
        <ModuleCardSkeleton />
        <ModuleCardSkeleton />
        <ModuleCardSkeleton />
      </main>
    </div>
  );
}

export function LevelSelectionSkeleton({ count = 4, isGeoboard = false }: { count?: number; isGeoboard?: boolean }) {
  return (
    <div className="w-full flex-1 flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-8 pt-8 pb-2">
        <div className="h-8 w-48 bg-gray-200 rounded-xl mb-2 animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded-md animate-pulse" />
      </div>
      <main
        className={`grid content-start gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full ${
          isGeoboard
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {Array.from({ length: count }).map((_, idx) =>
          isGeoboard ? <GeoboardCardSkeleton key={idx} /> : <LevelCardSkeleton key={idx} />,
        )}
      </main>
    </div>
  );
}

export function DoctorDashboardSkeleton() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-8 animate-pulse">
      <div>
        <div className="h-9 w-64 bg-gray-200 rounded-xl mb-2" />
        <div className="h-4 w-96 bg-gray-100 rounded-md" />
      </div>

      {/* Create patient form skeleton */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="h-6 w-36 bg-gray-200 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="sm:col-span-2 h-12 bg-blue-100/70 rounded-xl" />
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 p-5 space-y-3">
        <div className="h-6 w-28 bg-gray-200 rounded-lg mb-4" />
        <div className="h-12 bg-gray-100 rounded-xl max-w-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      </section>
    </main>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-10 animate-pulse">
      <div>
        <div className="h-9 w-40 bg-gray-200 rounded-xl mb-2" />
        <div className="h-4 w-80 bg-gray-100 rounded-md" />
      </div>

      {/* Create doctor form skeleton */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="h-6 w-36 bg-gray-200 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="h-12 bg-gray-100 rounded-xl" />
          <div className="sm:col-span-2 h-12 bg-blue-100/70 rounded-xl" />
        </div>
      </section>

      {/* Doctors list skeleton */}
      <section className="space-y-4">
        <div className="h-6 w-28 bg-gray-200 rounded-lg" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="h-5 w-36 bg-gray-200 rounded-md mb-2" />
                <div className="h-4 w-48 bg-gray-100 rounded-md" />
              </div>
              <div className="h-10 w-28 bg-blue-50 rounded-xl" />
            </div>
          ))}
        </div>
      </section>

      {/* Patients managed by doctors skeleton */}
      <section className="space-y-6">
        <div className="h-6 w-60 bg-gray-200 rounded-lg" />
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <div className="h-5 w-44 bg-gray-200 rounded-md" />
          <div className="h-12 bg-gray-50 rounded-xl" />
          <div className="h-12 bg-gray-50 rounded-xl" />
        </div>
      </section>
    </main>
  );
}
