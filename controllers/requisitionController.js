// controllers/requisitionController.js
const Requisition = require('../models/Requisition');

/* ---------------------------------- utils --------------------------------- */
const toInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function buildFilter(q = {}) {
  const { status, supplier, plan, base, mealType, date, fromDate, toDate } = q;
  const f = {};
  if (status && status !== 'all') f.status = status;
  if (supplier && supplier !== 'all') f.supplier = supplier;
  if (plan) f.plan = plan;
  if (base) f.base = base;
  if (mealType) f.mealType = mealType;
  if (date) f.date = date;
  else if (fromDate || toDate) {
    f.date = {};
    if (fromDate) f.date.$gte = fromDate;
    if (toDate) f.date.$lte = toDate;
  }
  return f;
}


/* --------------------------------- reads ---------------------------------- */

// GET /api/requisitions?status=&supplier=&plan=&base=&mealType=&date=&fromDate=&toDate=&page=&limit=
exports.getRequisitions = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const limit = Math.min(toInt(req.query.limit, 50), 200);
    const page = Math.max(toInt(req.query.page, 1), 1);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Requisition.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit),
      Requisition.countDocuments(filter),
    ]);

    return res.json({
      data,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch requisitions', error: err.message });
  }
};

// GET /api/requisitions/:id
exports.getRequisitionById = async (req, res) => {
  try {
    const doc = await Requisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Requisition not found' });
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch requisition', error: err.message });
  }
};

// GET /api/requisitions/stats
exports.getStats = async (req, res) => {
  try {
    const [byStatus, suppliers] = await Promise.all([
      Requisition.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      // For header-level schema, suppliers may live inside items[].supplier (not always top-level).
      // If your schema stores supplier per-line only, keep this distinct as-is.
      Requisition.distinct('supplier'),
    ]);
    return res.json({ byStatus, suppliers });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
  }
};

/* --------------------------------- writes --------------------------------- */

// POST /api/requisitions
// Works for line-level. If you're using header-level, create through your generator instead.
exports.createRequisition = async (req, res) => {
  try {
    const { date, base, item, quantity, unit, requestedBy, supplier, status, plan } = req.body;

    // Minimal validation for line-level schema
    if (!date || !base || !item || quantity == null || !unit || !requestedBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const created = await Requisition.create({
      date,
      base,
      item,
      quantity,
      unit,
      requestedBy,
      supplier: supplier || 'Default Supplier',
      status: status || 'pending',
      plan: plan || undefined,
    });

    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create requisition', error: err.message });
  }
};

// PUT /api/requisitions/:id
const mongoose = require('mongoose');

exports.updateRequisition = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid requisition id' });
    }
    const updated = await Requisition.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Requisition not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update requisition', error: err.message });
  }
};


// DELETE /api/requisitions/:id
exports.deleteRequisition = async (req, res) => {
  try {
    const deleted = await Requisition.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Requisition not found' });
    return res.json({ message: 'Requisition deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete requisition', error: err.message });
  }
};

// POST /api/requisitions/import
// Accepts an array of requisitions (either line-level docs or header-level docs)
exports.importGenerated = async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ message: 'Invalid data format. Expected an array.' });
    }
    const inserted = await Requisition.insertMany(payload, { ordered: false });
    return res.status(201).json({ message: 'Imported successfully', count: inserted.length });
  } catch (err) {
    return res.status(500).json({ message: 'Bulk import failed', error: err.message });
  }
};

/* ------------------------------- approvals -------------------------------- */

// PUT /api/requisitions/:id/approve
// - For header-level: sets header status to approved AND all items[].status to approved (if items exist)
// - For line-level: just sets the doc status to approved
// PUT /api/requisitions/:id/approve
exports.approveRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Requisition.findById(id);
    if (!doc) return res.status(404).json({ message: 'Requisition not found' });

    // 1) approve header
    await Requisition.updateOne({ _id: id }, { $set: { status: 'approved' } });

    // 2) approve line items only if items is an array
    if (Array.isArray(doc.items) && doc.items.length > 0) {
      await Requisition.updateOne(
        { _id: id, items: { $type: 'array' } },
        { $set: { 'items.$[].status': 'approved' } }
      );
    }

    const updated = await Requisition.findById(id);
    return res.json({ message: 'Approved', requisition: updated });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to approve requisition', error: err.message });
  }
};


// PUT /api/requisitions/bulk-approve
// body: { date?, base?, supplier?, plan?, mealType?, fromDate?, toDate? }
// PUT /api/requisitions/bulk-approve
exports.bulkApprove = async (req, res) => {
  try {
    const filter = buildFilter(req.body || {}); // use your existing buildFilter if present, else compose from body

    // 1) approve headers for all matched
    const headersRes = await Requisition.updateMany(filter, {
      $set: { status: 'approved' }
    });

    // 2) approve line items only where items is an array
    const itemsRes = await Requisition.updateMany(
      { ...filter, items: { $type: 'array' } },
      { $set: { 'items.$[].status': 'approved' } }
    );

    const matched =
      (headersRes.matchedCount ?? headersRes.n ?? 0);
    const updated =
      (headersRes.modifiedCount ?? headersRes.nModified ?? 0) +
      (itemsRes.modifiedCount ?? itemsRes.nModified ?? 0);

    return res.json({
      message: 'Bulk approved',
      matched,
      updatedHeaders: headersRes.modifiedCount ?? headersRes.nModified ?? 0,
      updatedItems: itemsRes.modifiedCount ?? itemsRes.nModified ?? 0,
      updated
    });
  } catch (err) {
    return res.status(500).json({ message: 'Bulk approve failed', error: err.message });
  }
};

// controllers/requisitionController.js

// PUT /api/requisitions/:id/complete
// controllers/requisitionController.js - Simple test version
exports.completeRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualQuantities, completedBy } = req.body;
    
    console.log('Completion request:', { id, actualQuantities, completedBy });
    
    const doc = await Requisition.findById(id);
    if (!doc) return res.status(404).json({ message: 'Requisition not found' });
    
    // Update items with actual quantities
    if (Array.isArray(doc.items) && actualQuantities) {
      doc.items.forEach((item) => {
        const itemKey = item._id || item.ingredientId;
        if (actualQuantities[itemKey] !== undefined) {
          item.actualQuantity = actualQuantities[itemKey];
          item.status = 'completed';
        }
      });
    }

    // Update header status
    doc.status = 'completed';
    doc.completedAt = new Date();
    doc.completedBy = completedBy;

    await doc.save();
    
    console.log('Requisition completed successfully:', doc._id);
    return res.json({ message: 'Requisition completed successfully', requisition: doc });
  } catch (err) {
    console.error('Completion error:', err);
    return res.status(500).json({ message: 'Failed to complete requisition', error: err.message });
  }
};

// PUT /api/requisitions/:id/item/:itemId/complete
// controllers/requisitionController.js - Enhanced completion function
exports.completeRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualQuantities, completedBy, notes } = req.body;
    
    const doc = await Requisition.findById(id);
    if (!doc) return res.status(404).json({ message: 'Requisition not found' });
    
    // Check if already completed
    if (doc.status === 'completed') {
      return res.status(400).json({ message: 'Requisition is already completed' });
    }
    
    // Update items with actual quantities
    if (Array.isArray(doc.items) && actualQuantities) {
      let allItemsCompleted = true;
      
      doc.items.forEach((item) => {
        const itemId = item._id.toString();
        if (actualQuantities[itemId] !== undefined && actualQuantities[itemId] !== null) {
          item.actualQuantity = actualQuantities[itemId];
          item.status = 'completed';
        } else {
          // If any item doesn't have actual quantity, mark as not fully completed
          allItemsCompleted = false;
        }
      });
      
      // Only mark header as completed if all items are completed
      if (allItemsCompleted) {
        doc.status = 'completed';
        doc.completedAt = new Date();
        doc.completedBy = completedBy;
        doc.notes = notes;
      } else {
        // Partial completion - keep header status as approved
        doc.status = 'approved';
      }
    } else {
      // For line-level requisitions or missing actualQuantities
      doc.status = 'completed';
      doc.completedAt = new Date();
      doc.completedBy = completedBy;
      doc.notes = notes;
    }

    await doc.save();
    
    return res.json({ 
      message: 'Requisition completed successfully', 
      requisition: doc 
    });
  } catch (err) {
    return res.status(500).json({ 
      message: 'Failed to complete requisition', 
      error: err.message 
    });
  }
};