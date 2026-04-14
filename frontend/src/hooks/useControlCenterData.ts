import { useState } from 'react';
import apiService, { getAxiosErrorMessage } from '../services/api';
import {
  AdminAnalytics,
  AdminDashboard,
  AdminLogItem,
  AdminManagedSession,
  AdminReports,
  AdminSecurityEvent,
  AdminSlaSummary,
  AdminTrafficLog,
  AdminUser,
  BlacklistEntry,
  MlMetrics,
  MlStatus,
  ModeratorCallFlag,
  ModeratorOverview,
  ModeratorPresenceSnapshot,
  NumberCheckResult,
  RiskAnalysis,
  RiskMonitor,
  RiskStats,
  SecurityActivityItem,
  SecuritySession,
  SupportRequestAdmin,
  User,
  AccountNotification,
} from '../types';

type NotifyFn = (message: string) => void;

export function useControlCenterData(params: {
  currentUser: User | null;
  isAdmin: boolean;
  isModeratorLike: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  notify: NotifyFn;
  notifyError: NotifyFn;
}) {
  const { currentUser, isAdmin, isModeratorLike, setCurrentUser, notify, notifyError } = params;

  const [securitySessions, setSecuritySessions] = useState<SecuritySession[]>([]);
  const [securityActivity, setSecurityActivity] = useState<SecurityActivityItem[]>([]);
  const [accountNotifications, setAccountNotifications] = useState<AccountNotification[]>([]);
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
  const [adminSessions, setAdminSessions] = useState<AdminManagedSession[]>([]);
  const [adminSecurityActivity, setAdminSecurityActivity] = useState<AdminSecurityEvent[]>([]);
  const [adminTrafficLogs, setAdminTrafficLogs] = useState<AdminTrafficLog[]>([]);
  const [mlStatus, setMlStatus] = useState<MlStatus | null>(null);
  const [mlMetrics, setMlMetrics] = useState<MlMetrics | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [supportRequests, setSupportRequests] = useState<SupportRequestAdmin[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blacklistPhone, setBlacklistPhone] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [moderatorLoading, setModeratorLoading] = useState(false);
  const [moderatorOverview, setModeratorOverview] = useState<ModeratorOverview | null>(null);
  const [moderatorPresence, setModeratorPresence] = useState<ModeratorPresenceSnapshot | null>(null);
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
      const [sessions, activity, notifications] = await Promise.all([
        apiService.getSessions(),
        apiService.getSecurityActivity(),
        apiService.listNotifications(),
      ]);
      setSecuritySessions(sessions || []);
      setSecurityActivity(activity || []);
      setAccountNotifications(notifications || []);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const markAccountNotificationRead = async (id: string) => {
    try {
      await apiService.markNotificationRead(id);
      setAccountNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
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

  const loadModeratorOverview = async (options?: { silent?: boolean }) => {
    if (!isModeratorLike) return;
    if (!options?.silent) setModeratorLoading(true);
    try {
      const modOverview = await apiService.getModeratorOverview();
      setModeratorOverview(modOverview || null);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    } finally {
      if (!options?.silent) setModeratorLoading(false);
    }
  };

  const loadModeratorPresence = async () => {
    if (!isModeratorLike) return;
    try {
      const presence = await apiService.getModeratorPresence();
      setModeratorPresence(presence || null);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const loadModeratorFlags = async () => {
    if (!isModeratorLike) return;
    try {
      const flagsPage = await apiService.getAdminCallFlags(
        callFlagsStatus,
        callFlagsLimit,
        callFlagsOffset,
        callFlagsQuery,
        callFlagsSortBy,
        callFlagsSortDir,
      );
      setCallFlags(flagsPage?.items || []);
      setCallFlagsTotal(flagsPage?.total || 0);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    }
  };

  const loadModeratorData = async () => {
    if (!isModeratorLike) return;
    setModeratorLoading(true);
    try {
      const [modOverview, presence, flagsPage] = await Promise.all([
        apiService.getModeratorOverview(),
        apiService.getModeratorPresence(),
        apiService.getAdminCallFlags(
          callFlagsStatus,
          callFlagsLimit,
          callFlagsOffset,
          callFlagsQuery,
          callFlagsSortBy,
          callFlagsSortDir,
        ),
      ]);
      setModeratorOverview(modOverview || null);
      setModeratorPresence(presence || null);
      setCallFlags(flagsPage?.items || []);
      setCallFlagsTotal(flagsPage?.total || 0);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    } finally {
      setModeratorLoading(false);
    }
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    try {
      const [dashboard, analytics, slaSummary, reports, logs, users, mlS, mlM, bl, sessions, securityActivity, trafficLogs, support] = await Promise.all([
        apiService.getAdminDashboard(),
        apiService.getAdminAnalytics(),
        apiService.getAdminSlaSummary(),
        apiService.getAdminReports(),
        apiService.getAdminSystemLogs(),
        apiService.getAdminUsers(),
        apiService.getMlStatus(),
        apiService.getMlMetrics(),
        apiService.getAdminBlacklist(),
        apiService.getAdminSessions(),
        apiService.getAdminSecurityActivity(),
        apiService.getAdminTrafficLogs(),
        apiService.getAdminSupportRequests(),
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
      setAdminSessions(sessions || []);
      setAdminSecurityActivity(securityActivity || []);
      setAdminTrafficLogs(trafficLogs || []);
      setSupportRequests(support || []);
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
    } finally {
      setAdminLoading(false);
    }
  };

  const updateSupportRequestStatus = async (
    id: string,
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
  ) => {
    try {
      await apiService.updateSupportRequestStatus(id, status);
      await loadAdminData();
    } catch (e) {
      notifyError(getAxiosErrorMessage(e));
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
      if (isAdmin) await loadAdminData();
      if (isModeratorLike) await loadModeratorData();
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
    const result = await apiService.terminateSession(id);
    setSecuritySessions((prev) => prev.filter((session) => session.id !== id));
    if (result?.revoked) {
      notify('Session terminated');
    }
    await loadSecurityData();
  };

  const deleteBlacklist = async (id: string) => {
    await apiService.removeBlacklist(id);
    await loadAdminData();
  };

  const updateRole = async (id: string, role: 'user' | 'admin' | 'moderator') => {
    await apiService.updateUserRole(id, role);
    await loadAdminData();
    if (isModeratorLike) await loadModeratorData();
  };

  const deleteUser = async (id: string) => {
    await apiService.deleteAdminUser(id);
    notify('User deleted');
    await loadAdminData();
  };

  const forceEndCall = async (id: string) => {
    await apiService.forceEndAdminCall(id);
    notify('Call force-ended');
    await loadModeratorData();
    if (isAdmin) await loadAdminData();
  };

  const flagCall = async (id: string, reason?: string) => {
    await apiService.flagAdminCall(id, reason);
    notify('Call flagged for review');
    await loadModeratorData();
    if (isAdmin) await loadAdminData();
  };

  const resolveCallFlag = async (flagId: string) => {
    await apiService.resolveAdminCallFlag(flagId);
    notify('Flag resolved');
    await loadModeratorData();
    if (isAdmin) await loadAdminData();
  };

  const resolveAllFlagsForCall = async (callId: string) => {
    const result = await apiService.resolveAllAdminCallFlags(callId);
    notify(`Resolved ${result.resolved} flags`);
    await loadModeratorData();
    if (isAdmin) await loadAdminData();
  };

  return {
    security: {
      securitySessions,
      securityActivity,
      accountNotifications,
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
      markAccountNotificationRead,
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
    moderator: {
      moderatorOverview,
      moderatorPresence,
      moderatorLoading,
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
      loadModeratorOverview,
      loadModeratorPresence,
      loadModeratorFlags,
      loadModeratorData,
      forceEndCall,
      flagCall,
      resolveCallFlag,
      resolveAllFlagsForCall,
    },
    admin: {
      supportRequests,
      adminDashboard,
      adminAnalytics,
      adminSlaSummary,
      adminReports,
      adminLogs,
      adminUsers,
      adminSessions,
      adminSecurityActivity,
      adminTrafficLogs,
      mlStatus,
      mlMetrics,
      adminLoading,
      blacklist,
      blacklistPhone,
      setBlacklistPhone,
      blacklistReason,
      setBlacklistReason,
      loadAdminData,
      handleAddBlacklist,
      handleReloadMl,
      deleteBlacklist,
      updateRole,
      deleteUser,
      updateSupportRequestStatus,
    },
    meta: {
      currentUser,
    },
  };
}
