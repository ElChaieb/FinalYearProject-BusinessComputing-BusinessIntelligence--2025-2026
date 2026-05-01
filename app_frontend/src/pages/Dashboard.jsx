import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function DashboardOverview() {
  
  return ( 
    <div className="dashboard">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="dashboard-content">
          <h1>Dashboard Overview</h1>
          <p>Welcome to the dashboard! Use the sidebar to navigate through different sections.</p>
        </div>
      </div>
    </div>
  );
}
