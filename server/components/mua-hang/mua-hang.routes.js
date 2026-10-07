'use strict';
const repo = require('./mua-hang.repository');
const dxRepo = require('./de-xuat.repository');
const svc = require('./mua-hang.service');
const dx = require('./de-xuat.service');

module.exports = {
  fns: {
    sendPurchaseRequest: svc.sendPurchaseRequest,
    getPurchaseOrders: repo.getPurchaseOrders,          // đơn mua hàng đã gửi của 1 dự án (tab Mua hàng)
    setPurchaseStatus: svc.setPurchaseStatus,           // Đã duyệt -> Đã đặt hàng -> Đã nhận hàng
    listPurchaseRequests: svc.listPurchaseRequests,
    getPurchaseOrder: svc.getPurchaseOrder,
    resolvePurchaseRequest: svc.resolvePurchaseRequest,
    getDeXuatList: dxRepo.getDeXuatList,
    sendDeXuat: dx.sendDeXuat,
    listDeXuat: dx.listDeXuat,
    getDeXuat: dx.getDeXuat,
    resolveDeXuat: dx.resolveDeXuat
  },
  actor: ['sendPurchaseRequest', 'setPurchaseStatus', 'listPurchaseRequests', 'getPurchaseOrder', 'resolvePurchaseRequest',
    'sendDeXuat', 'listDeXuat', 'getDeXuat', 'resolveDeXuat'],
  admin: ['listPurchaseRequests', 'getPurchaseOrder', 'resolvePurchaseRequest', 'listDeXuat', 'getDeXuat', 'resolveDeXuat']
};
