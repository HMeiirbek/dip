import { useState } from 'react';
import apiService, { getAxiosErrorMessage } from '../services/api';
import {
  AdminAnalytics,
  AdminDashboard,
  AdminLogItem,
  AdminReports,
  AdminSlaSummary,
  AdminUser,
  BlacklistEntry,
  MlMetrics,
  MlStatus,
  ModeratorCallFlag,
  ModeratorOverview,
  NumberCheckResult,
  RiskAnalysis,
  RiskMonitor,
  RiskStats,
  SecurityActivityItem,
  SecuritySession,
  User,
} from '../types';

type NotifyFn = (message: string) => void;

export function useControlCenterData(params: {
  currentUser: User | null;
  isAdminLike: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  notify: NotifyFn;
  notifyError: NotifyFn;
}) {
  const { currentUser, isAdminLike, setCurrentUser, notify, notifyError } = params;

  const [securitySessions, setSecuritySessions] = useState<SecuritySession[]>([]);
  const [securityActivity, setSecurityActivity] = useState<SecurityActivityItem[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [riskMonitor, setRiskMonitor] = useState<RiskMonitor | null>(null);
  const [riskStats, setRiskStats] = useState<RiskStats | null>(null);
  const [checkPhone, setCheckPhone] = useState('');
  const [checkPhoneResult, setCheckPhoneResult] = useState<NumberCheckResult | null>(null);
  const [reportPhone, setReportPhone] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard | null>(null);
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalytics | null>(null);
  const [adminSlaSummary, setAdminSlaSummary] = useState<AdminSlaSummary | null>(null);
  const [adminReports, setAdminReports] = useState<AdminReports | null>(null);
  const [adminLogs, setAdminLogs] = useState<AdminLogItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [mlStatus, setMlStatus] = useState<MlStatus | null>(null);
  const [mlMetrics, setMlMetrics] = useState<MlMetrics | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blacklistPhone, setBlacklistPhone] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [moderatorOverview, setModeratorOverview] = useState<ModeratorOverview | null>(null);
  const [callFlags, setCallFlags] = useState<ModeratorCallFlag[]>([]);
  const [callFlagsStatus, setCallFlagsStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [callFlagsQuery, setCallFlagsQuery] = useState('');
  const [callFlagsOffset, setCallFlagsOffset] = useState(0);
  const [callFlagsLimit] = useState(8);
  const [callFlagsTotal, setCallFlagsTotal] = useState(0);
  const [callFlagsSortBy, setCallFlagsSortBy] = useState<'createdAt' | 'status' | 'actorRole'>('createdAt');
  const [callFlagsSortDir, setCallFlagsSortDir] = useState<'asc' | 'desc'>('desc');

  const loadSecurityData = async () => {
    try {
      const [sessions, activity] = await Promise.all([
        apiService.getSessions(),
        apiService.getSecurityActivity(),
      ]);
      setSecuritySessions(sessions || []);
      setSecurityActivity(activity || []);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const loadRiskData = async () => {
    try {
      const [analysis, monitor] = await Promise.all([
        apiService.getRiskAnalysis(),
        apiService.getRiskMonitor(),
      ]);
      setRiskAnalysis(analysis);
      setRiskMonitor(monitor);

      try {
        const stats = await apiService.getRiskStats();
        setRiskStats(stats);
      } catch {
        setRiskStats(null);
      }
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const loadAdminData = async () => {
    if (!isAdminLike) return;
    setAdminLoading(true);
    try {
      const [dashboard, analytics, slaSummary, reports, logs, users, mlS, mlM, bl, modOverview, flagsPage] = await Promise.all([
        apiService.getAdminDashboard(),
        apiService.getAdminAnalytics(),
        apiService.getAdminSlaSummary(),
        apiService.getAdminReports(),
        apiService.getAdminSystemLogs(),
        apiService.getAdminUsers(),
        apiService.getMlStatus(),
        apiService.getMlMetrics(),
        apiService.getAdminBlacklist(),
        apiService.getModeratorOverview(),
        apiService.getAdminCallFlags(
          callFlagsStatus,
          callFlagsLimit,
          callFlagsOffset,
          callFlagsQuery,
          callFlagsSortBy,
          callFlagsSortDir,
        ),
      ]);
      setAdminDashboard(dashboard);
      setAdminAnalytics(analytics);
      setAdminSlaSummary(slaSummary);
      setAdminReports(reports);
      setAdminLogs(logs || []);
      setAdminUsers(users || []);
      setMlStatus(mlS);
      setMlMetrics(mlM);
      setBlacklist(bl || []);
      setModeratorOverview(modOverview || null);
      setCallFlags(flagsPage?.items || []);
      setCallFlagsTotal(flagsPage?.total || 0);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    } finally {
      setAdminLoading(false);
    }
  };

  const handleVerifyRequest = async () => {
    try {
      const result = await apiService.requestVerifyCode();
      notify(result.code ? `Verify code: ${result.code}` : 'Verification code requested');
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const handleVerifySubmit = async () => {
    try {
      await apiService.verifyCode(verifyCode);
      const user = await apiService.getMe();
      setCurrentUser(user);
      setVerifyCode('');
      notify('Account verified');
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const handleForgotPassword = async () => {
    try {
      const result = await apiService.forgotPassword(resetIdentifier);
      notify(result.code ? `Reset code: ${result.code}` : 'Reset code sent');
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const handleResetPassword = async () => {
    try {
      await apiService.resetPassword(resetIdentifier, resetCode, newPassword);
      setResetCode('');
      setNewPassword('');
      notify('Password reset complete');
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const handleCheckNumber = async () => {
    try {
      const result = await apiService.checkNumber(checkPhone);
      setCheckPhoneResult(result);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const handleReportNumber = async () => {
    try {
      await apiService.reportNumber(reportPhone, reportDescription);
      notify('Number reported');
      setReportPhone('');
      setReportDescription('');
      await loadRiskData();
      if (isAdminLike) await loadAdminData();
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const handleAddBlacklist = async () => {
    try {
      await apiService.addBlacklist(blacklistPhone, blacklistReason);
      setBlacklistPhone('');
      setBlacklistReason('');
      notify('Number added to blacklist');
      await loadAdminData();
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const handleReloadMl = async () => {
    try {
      await apiService.reloadMl();
      notify('ML model reloaded');
      await loadAdminData();
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const terminateSession = async (id: string) => {
    await apiService.terminateSession(id);
    await loadSecurityData();
  };

  const deleteBlacklist = async (id: string) => {
    await apiService.removeBlacklist(id);
    await loadAdminData();
  };

  const updateRole = async (id: string, role: 'user' | 'admin' | 'moderator') => {
    await apiService.updateUserRole(id, role);
    await loadAdminData();
  };

  const forceEndCall = async (id: string) => {
    await apiService.forceEndAdminCall(id);
    notify('Call force-ended');
    await loadAdminData();
  };

  const flagCall = async (id: string, reason?: string) => {
    await apiService.flagAdminCall(id, reason);
    notify('Call flagged for review');
    await loadAdminData();
  };

  const resolveCallFlag = async (flagId: string) => {
    await apiService.resolveAdminCallFlag(flagId);
    notify('Flag resolved');
    await loadAdminData();
  };

  const resolveAllFlagsForCall = async (callId: string) => {
    const result = await apiService.resolveAllAdminCallFlags(callId);
    notify(`Resolved ${result.resolved} flags`);
    await loadAdminData();
  };

  return {
    security: {
      securitySessions,
      securityActivity,
      verifyCode,
      setVerifyCode,
      resetIdentifier,
      setResetIdentifier,
      resetCode,
      setResetCode,
      newPassword,
      setNewPassword,
      loadSecurityData,
      handleVerifyRequest,
      handleVerifySubmit,
      handleForgotPassword,
      handleResetPassword,
      terminateSession,
    },
    risk: {
      riskAnalysis,
      riskMonitor,
      riskStats,
      checkPhone,
      setCheckPhone,
      checkPhoneResult,
      reportPhone,
      setReportPhone,
      reportDescription,
      setReportDescription,
      loadRiskData,
      handleCheckNumber,
      handleReportNumber,
    },
    admin: {
      adminDashboard,
      adminAnalytics,
      adminSlaSummary,
      adminReports,
      adminLogs,
      adminUsers,
      mlStatus,
      mlMetrics,
      adminLoading,
      blacklist,
      moderatorOverview,
      callFlags,
      callFlagsStatus,
      setCallFlagsStatus,
      callFlagsQuery,
      setCallFlagsQuery,
      callFlagsOffset,
      setCallFlagsOffset,
      callFlagsLimit,
      callFlagsTotal,
      callFlagsSortBy,
      setCallFlagsSortBy,
      callFlagsSortDir,
      setCallFlagsSortDir,
      blacklistPhone,
      setBlacklistPhone,
      blacklistReason,
      setBlacklistReason,
      loadAdminData,
      handleAddBlacklist,
      handleReloadMl,
      deleteBlacklist,
      updateRole,
      forceEndCall,
      flagCall,
      resolveCallFlag,
      resolveAllFlagsForCall,
    },
    meta: {
      currentUser,
    },
  };
}
