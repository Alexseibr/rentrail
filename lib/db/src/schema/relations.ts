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

export const companiesRelations = relations(companies, ({ many }) => ({
  settings: many(companySettings),
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
