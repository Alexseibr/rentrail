import { relations } from "drizzle-orm";
import { companies } from "./companies";
import { companySettings } from "./company-settings";
import { branches } from "./branches";
import { stations } from "./stations";
import { users } from "./users";
import { roles } from "./roles";
import { permissions } from "./permissions";
import { rolePermissions } from "./role-permissions";
import { userCompanyMemberships } from "./user-company-memberships";
import { userBranchMemberships } from "./user-branch-memberships";
import { sessions } from "./sessions";
import { clients } from "./clients";
import { assets } from "./assets";
import { assetStatusHistory } from "./asset-status-history";
import { rentalPlans } from "./rental-plans";
import { rentals } from "./rentals";
import { rentalStatusHistory } from "./rental-status-history";
import { payments } from "./payments";
import { deposits } from "./deposits";
import { blacklistEntries } from "./blacklist-entries";
import { auditLogs } from "./audit-logs";
import { companyBranding } from "./company-branding";
import { inquiries } from "./inquiries";
import { b2bRequests } from "./b2b-requests";
import { notifications } from "./notifications";
import { companyModules } from "./company-modules";
import { devices } from "./devices";
import { assetDevices } from "./asset-devices";
import { telemetrySnapshots } from "./telemetry-snapshots";
import { telemetryEvents } from "./telemetry-events";
import { locationHistory } from "./location-history";
import { batteries } from "./batteries";
import { batteryAssignments } from "./battery-assignments";
import { batteryEvents } from "./battery-events";
import { geofences } from "./geofences";
import { deviceCommands } from "./device-commands";
import { providerApiKeys } from "./provider-api-keys";
import { platformRoles, platformUserRoles } from "./platform-roles";
import { platformAuditLogs } from "./platform-audit-logs";

export const companiesRelations = relations(companies, ({ one, many }) => ({
  settings: many(companySettings),
  branding: one(companyBranding, { fields: [companies.id], references: [companyBranding.companyId] }),
  branches: many(branches),
  stations: many(stations),
  companyMemberships: many(userCompanyMemberships),
  clients: many(clients),
  assets: many(assets),
  rentalPlans: many(rentalPlans),
  rentals: many(rentals),
  payments: many(payments),
  deposits: many(deposits),
  blacklistEntries: many(blacklistEntries),
  auditLogs: many(auditLogs),
  inquiries: many(inquiries),
  b2bRequests: many(b2bRequests),
  modules: many(companyModules),
}));

export const companySettingsRelations = relations(companySettings, ({ one }) => ({
  company: one(companies, { fields: [companySettings.companyId], references: [companies.id] }),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  company: one(companies, { fields: [branches.companyId], references: [companies.id] }),
  stations: many(stations),
  branchMemberships: many(userBranchMemberships),
  assets: many(assets),
  rentals: many(rentals),
  payments: many(payments),
  blacklistEntries: many(blacklistEntries),
}));

export const stationsRelations = relations(stations, ({ one, many }) => ({
  company: one(companies, { fields: [stations.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [stations.branchId], references: [branches.id] }),
  assets: many(assets),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  companyMemberships: many(userCompanyMemberships),
  branchMemberships: many(userBranchMemberships),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  companyMemberships: many(userCompanyMemberships),
  branchMemberships: many(userBranchMemberships),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const userCompanyMembershipsRelations = relations(userCompanyMemberships, ({ one }) => ({
  user: one(users, { fields: [userCompanyMemberships.userId], references: [users.id] }),
  company: one(companies, { fields: [userCompanyMemberships.companyId], references: [companies.id] }),
  role: one(roles, { fields: [userCompanyMemberships.roleId], references: [roles.id] }),
}));

export const userBranchMembershipsRelations = relations(userBranchMemberships, ({ one }) => ({
  user: one(users, { fields: [userBranchMemberships.userId], references: [users.id] }),
  company: one(companies, { fields: [userBranchMemberships.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [userBranchMemberships.branchId], references: [branches.id] }),
  role: one(roles, { fields: [userBranchMemberships.roleId], references: [roles.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  company: one(companies, { fields: [clients.companyId], references: [companies.id] }),
  rentals: many(rentals),
  payments: many(payments),
  deposits: many(deposits),
  blacklistEntries: many(blacklistEntries),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  company: one(companies, { fields: [assets.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [assets.branchId], references: [branches.id] }),
  station: one(stations, { fields: [assets.stationId], references: [stations.id] }),
  statusHistory: many(assetStatusHistory),
  rentals: many(rentals),
}));

export const assetStatusHistoryRelations = relations(assetStatusHistory, ({ one }) => ({
  company: one(companies, { fields: [assetStatusHistory.companyId], references: [companies.id] }),
  asset: one(assets, { fields: [assetStatusHistory.assetId], references: [assets.id] }),
  changedByUser: one(users, { fields: [assetStatusHistory.changedByUserId], references: [users.id] }),
}));

export const rentalPlansRelations = relations(rentalPlans, ({ one, many }) => ({
  company: one(companies, { fields: [rentalPlans.companyId], references: [companies.id] }),
  rentals: many(rentals),
}));

export const rentalsRelations = relations(rentals, ({ one, many }) => ({
  company: one(companies, { fields: [rentals.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [rentals.branchId], references: [branches.id] }),
  station: one(stations, { fields: [rentals.stationId], references: [stations.id] }),
  client: one(clients, { fields: [rentals.clientId], references: [clients.id] }),
  asset: one(assets, { fields: [rentals.assetId], references: [assets.id] }),
  rentalPlan: one(rentalPlans, { fields: [rentals.rentalPlanId], references: [rentalPlans.id] }),
  issuedByUser: one(users, { fields: [rentals.issuedByUserId], references: [users.id] }),
  returnedToStation: one(stations, { fields: [rentals.returnedToStationId], references: [stations.id] }),
  statusHistory: many(rentalStatusHistory),
  payments: many(payments),
  deposits: many(deposits),
}));

export const rentalStatusHistoryRelations = relations(rentalStatusHistory, ({ one }) => ({
  company: one(companies, { fields: [rentalStatusHistory.companyId], references: [companies.id] }),
  rental: one(rentals, { fields: [rentalStatusHistory.rentalId], references: [rentals.id] }),
  changedByUser: one(users, { fields: [rentalStatusHistory.changedByUserId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  company: one(companies, { fields: [payments.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [payments.branchId], references: [branches.id] }),
  client: one(clients, { fields: [payments.clientId], references: [clients.id] }),
  rental: one(rentals, { fields: [payments.rentalId], references: [rentals.id] }),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  company: one(companies, { fields: [deposits.companyId], references: [companies.id] }),
  client: one(clients, { fields: [deposits.clientId], references: [clients.id] }),
  rental: one(rentals, { fields: [deposits.rentalId], references: [rentals.id] }),
}));

export const blacklistEntriesRelations = relations(blacklistEntries, ({ one }) => ({
  company: one(companies, { fields: [blacklistEntries.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [blacklistEntries.branchId], references: [branches.id] }),
  client: one(clients, { fields: [blacklistEntries.clientId], references: [clients.id] }),
  createdByUser: one(users, { fields: [blacklistEntries.createdByUserId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  company: one(companies, { fields: [auditLogs.companyId], references: [companies.id] }),
  actorUser: one(users, { fields: [auditLogs.actorUserId], references: [users.id] }),
}));

export const companyBrandingRelations = relations(companyBranding, ({ one }) => ({
  company: one(companies, { fields: [companyBranding.companyId], references: [companies.id] }),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  company: one(companies, { fields: [inquiries.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [inquiries.branchId], references: [branches.id] }),
  station: one(stations, { fields: [inquiries.stationId], references: [stations.id] }),
  processedByUser: one(users, { fields: [inquiries.processedByUserId], references: [users.id] }),
  convertedClient: one(clients, { fields: [inquiries.convertedClientId], references: [clients.id] }),
  convertedRental: one(rentals, { fields: [inquiries.convertedRentalId], references: [rentals.id] }),
}));

export const b2bRequestsRelations = relations(b2bRequests, ({ one }) => ({
  company: one(companies, { fields: [b2bRequests.companyId], references: [companies.id] }),
  assignedToUser: one(users, { fields: [b2bRequests.assignedToUserId], references: [users.id] }),
  processedByUser: one(users, { fields: [b2bRequests.processedByUserId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  company: one(companies, { fields: [notifications.companyId], references: [companies.id] }),
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const companyModulesRelations = relations(companyModules, ({ one }) => ({
  company: one(companies, { fields: [companyModules.companyId], references: [companies.id] }),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  company: one(companies, { fields: [devices.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [devices.branchId], references: [branches.id] }),
  station: one(stations, { fields: [devices.stationId], references: [stations.id] }),
  assetBindings: many(assetDevices),
  commands: many(deviceCommands),
}));

export const assetDevicesRelations = relations(assetDevices, ({ one }) => ({
  company: one(companies, { fields: [assetDevices.companyId], references: [companies.id] }),
  asset: one(assets, { fields: [assetDevices.assetId], references: [assets.id] }),
  device: one(devices, { fields: [assetDevices.deviceId], references: [devices.id] }),
}));

export const telemetrySnapshotsRelations = relations(telemetrySnapshots, ({ one }) => ({
  company: one(companies, { fields: [telemetrySnapshots.companyId], references: [companies.id] }),
  asset: one(assets, { fields: [telemetrySnapshots.assetId], references: [assets.id] }),
  device: one(devices, { fields: [telemetrySnapshots.deviceId], references: [devices.id] }),
}));

export const telemetryEventsRelations = relations(telemetryEvents, ({ one }) => ({
  company: one(companies, { fields: [telemetryEvents.companyId], references: [companies.id] }),
  asset: one(assets, { fields: [telemetryEvents.assetId], references: [assets.id] }),
  device: one(devices, { fields: [telemetryEvents.deviceId], references: [devices.id] }),
}));

export const locationHistoryRelations = relations(locationHistory, ({ one }) => ({
  company: one(companies, { fields: [locationHistory.companyId], references: [companies.id] }),
  asset: one(assets, { fields: [locationHistory.assetId], references: [assets.id] }),
  device: one(devices, { fields: [locationHistory.deviceId], references: [devices.id] }),
}));

export const batteriesRelations = relations(batteries, ({ one, many }) => ({
  company: one(companies, { fields: [batteries.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [batteries.branchId], references: [branches.id] }),
  station: one(stations, { fields: [batteries.stationId], references: [stations.id] }),
  assignments: many(batteryAssignments),
  events: many(batteryEvents),
}));

export const batteryAssignmentsRelations = relations(batteryAssignments, ({ one }) => ({
  company: one(companies, { fields: [batteryAssignments.companyId], references: [companies.id] }),
  battery: one(batteries, { fields: [batteryAssignments.batteryId], references: [batteries.id] }),
  asset: one(assets, { fields: [batteryAssignments.assetId], references: [assets.id] }),
  installedByUser: one(users, { fields: [batteryAssignments.installedByUserId], references: [users.id] }),
}));

export const batteryEventsRelations = relations(batteryEvents, ({ one }) => ({
  company: one(companies, { fields: [batteryEvents.companyId], references: [companies.id] }),
  battery: one(batteries, { fields: [batteryEvents.batteryId], references: [batteries.id] }),
  asset: one(assets, { fields: [batteryEvents.assetId], references: [assets.id] }),
}));

export const geofencesRelations = relations(geofences, ({ one }) => ({
  company: one(companies, { fields: [geofences.companyId], references: [companies.id] }),
  branch: one(branches, { fields: [geofences.branchId], references: [branches.id] }),
  station: one(stations, { fields: [geofences.stationId], references: [stations.id] }),
}));

export const deviceCommandsRelations = relations(deviceCommands, ({ one }) => ({
  company: one(companies, { fields: [deviceCommands.companyId], references: [companies.id] }),
  asset: one(assets, { fields: [deviceCommands.assetId], references: [assets.id] }),
  device: one(devices, { fields: [deviceCommands.deviceId], references: [devices.id] }),
  requestedByUser: one(users, { fields: [deviceCommands.requestedByUserId], references: [users.id] }),
}));

export const providerApiKeysRelations = relations(providerApiKeys, ({ one }) => ({
  company: one(companies, { fields: [providerApiKeys.companyId], references: [companies.id] }),
}));

export const platformRolesRelations = relations(platformRoles, ({ many }) => ({
  userRoles: many(platformUserRoles),
}));

export const platformUserRolesRelations = relations(platformUserRoles, ({ one }) => ({
  user: one(users, { fields: [platformUserRoles.userId], references: [users.id] }),
  platformRole: one(platformRoles, { fields: [platformUserRoles.platformRoleId], references: [platformRoles.id] }),
  grantedByUser: one(users, { fields: [platformUserRoles.grantedBy], references: [users.id] }),
}));

export const platformAuditLogsRelations = relations(platformAuditLogs, ({ one }) => ({
  actorUser: one(users, { fields: [platformAuditLogs.actorUserId], references: [users.id] }),
  targetCompany: one(companies, { fields: [platformAuditLogs.targetCompanyId], references: [companies.id] }),
}));
