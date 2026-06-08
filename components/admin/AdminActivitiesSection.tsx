"use client";

import { useAdminAnalytics } from "@/context/AdminAnalyticsContext";

export default function AdminActivitiesSection() {
  const {
    recentActivities,
    isLoadingActivities,
    refreshActivities,
  } = useAdminAnalytics();

  return (
    <div className="w-full bg-[#161e2e] rounded-lg shadow-lg p-6 border border-[#22304a] pb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-[#8ec0ff]">Recent Activity</h2>
        <button
          onClick={refreshActivities}
          disabled={isLoadingActivities}
          className="text-[#3390ff] hover:text-[#8ec0ff] text-sm font-medium disabled:opacity-50"
        >
          {isLoadingActivities ? "Loading..." : "Refresh"}
        </button>
      </div>
      <div className="space-y-4">
        {isLoadingActivities ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3390ff] mx-auto" />
            <p className="text-[#8ec0ff] mt-2">Loading recent activities...</p>
          </div>
        ) : recentActivities.length > 0 ? (
          recentActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between p-4 bg-[#22304a] rounded-lg"
            >
              <div>
                {activity.type === "user_created" ? (
                  <>
                    <p className="font-medium text-white">User account created</p>
                    <p className="text-sm text-[#8ec0ff]">Email: {activity.email}</p>
                  </>
                ) : activity.type === "purchase" ? (
                  <>
                    <p className="font-medium text-white">Purchase made</p>
                    <p className="text-sm text-[#8ec0ff]">Email: {activity.email}</p>
                    {activity.orderId && (
                      <p className="text-sm text-[#8ec0ff]">Order ID: {activity.orderId}</p>
                    )}
                    {activity.total != null && (
                      <p className="text-sm text-[#8ec0ff]">Total: ₱{activity.total}</p>
                    )}
                  </>
                ) : null}
              </div>
              <span className="text-sm text-[#8ec0ff]">
                {activity.timestamp.toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-[#8ec0ff]">No recent activities.</p>
          </div>
        )}
      </div>
    </div>
  );
}
