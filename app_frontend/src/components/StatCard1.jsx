export default function StatCard1({ name, stat, previousStat }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {name}
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-2.5">
        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
          {stat}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          from {previousStat}
        </p>
      </div>
    </div>
  );
}
