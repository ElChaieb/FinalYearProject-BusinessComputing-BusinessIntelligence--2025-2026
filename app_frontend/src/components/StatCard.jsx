function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function StatCard({ name, stat, change, changeType }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {name}
        </dt>
        <span
          className={classNames(
            changeType === "positive"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20"
              : "bg-red-50 text-red-700 ring-red-200 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20",
            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
          )}
        >
          {change}
        </span>
      </div>
      <dd className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
        {stat}
      </dd>
    </div>
  );
}
