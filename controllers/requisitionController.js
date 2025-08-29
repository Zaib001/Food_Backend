// controllers/requisitionController.js
const Requisition = require('../models/Requisition');
const Ingredient = require('../models/Ingredient');
const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');

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


// Normalize payload to the new shape { date, base?, requestedBy, status?, items: [...] }
function normalizeCreateBody(body = {}) {
  const {
    // header-level fields (old & new)
    date,
    base,
    requestedBy,
    status,
    menuName,
    mealType,
    peopleCount,
    portionFactor,
    notes,
    linkedMenuIds,
    // legacy line-level fields (old shape)
    item,
    quantity,
    unit,
    supplier,
    ingredientId,
    // new shape
    items,
  } = body;

  let normalizedItems = [];

  if (Array.isArray(items) && items.length > 0) {
    // Accept items as-is but coerce quantities and trim strings
    normalizedItems = items.map((it) => ({
      ingredientId: it.ingredientId || undefined,
      item: (it.item || '').trim(),
      unit: (it.unit || '').trim(),
      supplier: (it.supplier || '').trim(),
      quantity: toNum(it.quantity, 0),
      status: it.status || 'pending',
    }));
  } else if (item || unit || quantity != null || supplier || ingredientId) {
    // Legacy single-line payload -> wrap into items[0]
    normalizedItems = [
      {
        ingredientId: ingredientId || undefined,
        item: (item || '').trim(),
        unit: (unit || '').trim(),
        supplier: (supplier || '').trim() || 'BASE',
        quantity: toNum(quantity, 0),
        status: 'pending',
      },
    ];
  }

  return {
    date,
    base: (base || '').trim(),
    requestedBy: (requestedBy || '').trim(),
    status: (status || 'pending').trim(),
    menuName: (menuName || '').trim() || undefined,
    mealType: mealType || undefined,
    peopleCount: toNum(peopleCount, 100),
    portionFactor: portionFactor != null ? toNum(portionFactor, undefined) : undefined,
    notes: (notes || '').trim() || undefined,
    linkedMenuIds: Array.isArray(linkedMenuIds) ? linkedMenuIds : undefined,
    items: normalizedItems,
  };
}

// Lightweight validation: require date, requestedBy, and at least one line with item+unit
function basicValidateCreate(norm) {
  if (!norm.date) return 'date is required';
  if (!norm.requestedBy) return 'requestedBy is required';
  if (!Array.isArray(norm.items) || norm.items.length === 0) {
    return 'at least one item is required';
  }
  const first = norm.items[0];
  if (!first.item) return 'item is required';
  if (!first.unit) return 'unit is required';
  // quantity can be 0, allow it; coerce already done
  return null;
}

exports.createRequisition = async (req, res) => {
  try {
    const norm = normalizeCreateBody(req.body);
    const err = basicValidateCreate(norm);
    if (err) {
      return res.status(400).json({ message: `Missing required fields: ${err}` });
    }

    // Default supplier fallback for each line
    norm.items = norm.items.map((it) => ({
      ...it,
      supplier: it.supplier || 'BASE',
    }));

    const created = await Requisition.create(norm);
    return res.status(201).json(created);
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Failed to create requisition', error: err.message });
  }
};

exports.updateRequisition = async (req, res) => {
  try {
    const { id } = req.params;

    const norm = normalizeCreateBody(req.body);
    // If updating, we don’t insist on all required fields, but keep basic sanity:
    if (!norm.date) norm.date = new Date().toISOString().slice(0, 10);
    if (!norm.requestedBy) norm.requestedBy = 'Manual Entry';

    // Optional: allow partial update of items—if not provided, keep existing
    const existing = await Requisition.findById(id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    // Merge header fields
    existing.date = norm.date;
    if (norm.base !== undefined) existing.base = norm.base;
    if (norm.status) existing.status = norm.status;
    if (norm.requestedBy) existing.requestedBy = norm.requestedBy;
    if (norm.menuName !== undefined) existing.menuName = norm.menuName;
    if (norm.mealType !== undefined) existing.mealType = norm.mealType;
    if (norm.peopleCount !== undefined) existing.peopleCount = norm.peopleCount;
    if (norm.portionFactor !== undefined) existing.portionFactor = norm.portionFactor;
    if (norm.notes !== undefined) existing.notes = norm.notes;
    if (norm.linkedMenuIds !== undefined) existing.linkedMenuIds = norm.linkedMenuIds;

    if (Array.isArray(norm.items) && norm.items.length > 0) {
      existing.items = norm.items.map((it) => ({ ...it, supplier: it.supplier || 'BASE' }));
    }

    const saved = await existing.save();
    return res.status(200).json(saved);
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Failed to update requisition', error: err.message });
  }
};

exports.getAllRequisitions = async (req, res) => {
  try {
    const { status, supplier } = req.query;

    const q = {};
    if (status && status !== 'all') q.status = status;

    // If supplier filter is provided, match either header supplier (legacy)
    // OR any items.supplier (new schema).
    if (supplier && supplier !== 'all') {
      q.$or = [{ supplier }, { 'items.supplier': supplier }];
    }

    const docs = await Requisition.find(q).sort({ createdAt: -1 });

    // Return as-is; the frontend already normalizes fallback to items[0]
    return res.status(200).json({ data: docs, total: docs.length });
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Failed to fetch requisitions', error: err.message });
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



/* utils */
const toNum = (v, d = 0) => {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// Very simple unit normalization. Expand as needed.
function convertQty(qty, fromUnit, toUnit) {
  const q = toNum(qty, 0);
  const f = String(fromUnit || '').toLowerCase();
  const t = String(toUnit || '').toLowerCase();
  if (!q || !t) return q;

  // same unit -> no change
  if (f === t) return q;

  // common weight conversions
  const gPerKg = 1000;
  const lbToKg = 0.453592;

  // weights
  if ((f === 'kg' || f === 'g' || f === 'lb' || f === 'lbs') &&
      (t === 'kg' || t === 'g' || t === 'lb' || t === 'lbs')) {
    // normalize to kg
    let inKg = q;
    if (f === 'g') inKg = q / gPerKg;
    else if (f === 'lb' || f === 'lbs') inKg = q * lbToKg;

    // convert to target
    if (t === 'kg') return inKg;
    if (t === 'g') return inKg * gPerKg;
    if (t === 'lb' || t === 'lbs') return inKg / lbToKg;
  }

  // liquids etc. (extend with 'lt'/'ml' if you use them)
  if ((f === 'lt' || f === 'l') && (t === 'lt' || t === 'l')) return q;

  // Fallback: return original qty if we don't know how to convert
  return q;
}

/**
 * PUT /api/requisitions/:id/complete
 * Body: { actualQuantities: { [itemId]: number }, completedBy?, notes? }
 */
exports.completeRequisition = async (req, res) => {
  const session = await mongoose.startSession();

  console.log('--- completeRequisition:start ---');
  console.log('params:', req.params);
  console.log('body:', req.body);

  // helpers
  const safeToNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

  // Resolve or create an Ingredient for this line
  const ensureIngredient = async ({ ingredientId, item, supplier, unit }, session) => {
    // if ID given, verify it exists
    if (ingredientId) {
      const ing = await Ingredient.findById(ingredientId).session(session);
      if (ing) return ing;
      // fall through to name/supplier resolution if id is stale
    }

    const name = (item || '').trim();
    const sup  = (supplier || '').trim();

    // Try name+supplier first, then name only
    let ing = null;
    if (name) {
      if (sup) {
        ing = await Ingredient.findOne({ name, supplier: sup }).session(session);
      }
      if (!ing) {
        ing = await Ingredient.findOne({ name }).session(session);
      }
    }
    if (ing) return ing;

    // No match: create a new Ingredient on the fly
    if (!name) return null; // cannot create without a name
    const originalUnit = isStr(unit) ? unit : 'unit';

    try {
      ing = await Ingredient.create([{
        name,
        supplier: sup || undefined,
        originalUnit,         // used as the base unit for this ingredient
        stock: 0
      }], { session });

      return ing?.[0] || null;
    } catch (e) {
      console.error('    [ERR] auto-create Ingredient failed:', e?.message);
      return null;
    }
  };

  try {
    let resultPayload = { movementsCreated: 0, alreadyPosted: false };

    await session.withTransaction(async () => {
      const { id } = req.params;

      // Accept both shapes (legacy + modal)
      const {
        actualQuantities: bodyActualQuantities = {},
        completedBy,
        notes,
        receivedDate,                  // "YYYY-MM-DD"
        lines = [],                    // modal payload
        grandTotal,                    // optional
      } = req.body || {};

      // Normalize actual quantities from either payload
      const actualQuantities = { ...(bodyActualQuantities || {}) };
      if (Array.isArray(lines) && lines.length > 0) {
        for (const l of lines) {
          if (l?.lineId) {
            actualQuantities[String(l.lineId)] = safeToNum(l.receivedQty, 0);
          }
        }
      }

      console.log('[TX] loading requisition:', id);
      const doc = await Requisition.findById(id).session(session);
      if (!doc) {
        console.warn('[TX] requisition not found:', id);
        throw Object.assign(new Error('Requisition not found'), { statusCode: 404 });
      }

      console.log('[TX] current status:', doc.status);

      // Idempotency: if already completed AND movements exist -> exit
      const existingMovements = await Inventory.exists({
        sourceType: 'Requisition',
        sourceId: String(id),
      }).session(session);
      console.log('[TX] existingMovements?', !!existingMovements);

      if (doc.status === 'completed' && existingMovements) {
        console.log('[TX] idempotent exit -> already completed & posted');
        resultPayload.alreadyPosted = true;
        return;
      }

      // FE lines[] map by id
      const lineById = {};
      if (Array.isArray(lines)) {
        for (const l of lines) if (l?.lineId) lineById[String(l.lineId)] = l;
      }

      // --- Update requisition lines with actuals & mirror possible fields
      let allLinesDone = true;

      if (Array.isArray(doc.items) && doc.items.length > 0) {
        for (const it of doc.items) {
          const k = it._id?.toString();
          const hasKey = Object.prototype.hasOwnProperty.call(actualQuantities, k);

          if (hasKey && actualQuantities[k] !== null && actualQuantities[k] !== undefined) {
            const recv = safeToNum(actualQuantities[k], 0);
            it.actualQuantity = recv;
            if ('receivedQty' in it) it.receivedQty = recv;

            const src = lineById[k];
            if (src) {
              if ('unitPrice' in it && src.unitPrice !== undefined) it.unitPrice = safeToNum(src.unitPrice, 0);
              if ('lineTotal' in it && src.lineTotal !== undefined) it.lineTotal = safeToNum(src.lineTotal, 0);
              if ('unit' in it && isStr(src.unit)) it.unit = src.unit;
              if ('item' in it && isStr(src.item)) it.item = src.item;
              if ('supplier' in it && isStr(src.supplier)) it.supplier = src.supplier;
              if (src.ingredientId) it.ingredientId = src.ingredientId; // mirror if FE supplied
            }

            it.status = 'completed';
          } else {
            allLinesDone = false;
          }
        }
      }

      // Header status + meta
      doc.status = allLinesDone ? 'completed' : 'approved';
      if (allLinesDone) {
        doc.completedAt = new Date();
        if (completedBy) doc.completedBy = completedBy;
        if (typeof notes !== 'undefined') doc.notes = notes;
        if (receivedDate) {
          const rd = new Date(receivedDate);
          if (!isNaN(rd.getTime())) doc.receivedDate = rd;
        }
      }

      console.log('[TX] saving requisition with status:', doc.status);
      await doc.save({ session });

      // Post movements if not already
      if (!existingMovements) {
        console.log('[TX] posting inventory movements...');

        // Movement date string (schema requires String)
        let movementDateStr = '';
        if (isStr(receivedDate)) {
          movementDateStr = receivedDate.trim();
        } else if (isStr(doc.date)) {
          movementDateStr = doc.date;
        } else {
          movementDateStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        }

        for (const line of doc.items || []) {
          const qtyFromFormUnit = safeToNum(line.actualQuantity, 0);
          if (qtyFromFormUnit <= 0) {
            console.log('  [SKIP] line qty <= 0 for item:', line.item || line.ingredientId);
            continue;
          }

          const src = lineById[String(line._id)];

          // Pricing
          const unitPrice = src?.unitPrice !== undefined
            ? safeToNum(src.unitPrice, 0)
            : safeToNum(line.unitPrice, 0);

          const lineTotal = src?.lineTotal !== undefined
            ? safeToNum(src.lineTotal, 0)
            : unitPrice * qtyFromFormUnit;

          // Ensure Ingredient (find or auto-create)
          const candidate = {
            ingredientId: src?.ingredientId || line.ingredientId,
            item: src?.item || line.item,
            supplier: src?.supplier || line.supplier || '',
            unit: src?.unit || line.unit
          };

          const ing = await ensureIngredient(candidate, session);
          if (!ing) {
            const msg = `Missing ingredientId for item "${candidate.item || ''}". Please select a valid ingredient.`;
            console.error('    [ERR] ' + msg);
            const e = Object.assign(new Error(msg), { statusCode: 400 });
            throw e;
          }

          // Units & normalization
          const fromUnit = isStr(line.unit) ? line.unit : (ing.originalUnit || 'unit');
          const baseUnit = ing.originalUnit || fromUnit || 'unit';
          const normalizedQty = convertQty(qtyFromFormUnit, fromUnit, baseUnit);

          console.log('  [LINE]', {
            ingredientId: String(ing._id),
            item: candidate.item,
            supplier: candidate.supplier,
            fromUnit,
            toUnit: baseUnit,
            qtyFromFormUnit,
            normalizedQty,
            unitPrice,
            lineTotal,
          });

          try {
            const created = await Inventory.create(
              [
                {
                  ingredientId: ing._id,
                  ingredientName: ing?.name || candidate.item,
                  base: doc.base || 'BASE',
                  supplier: candidate.supplier || '',
                  quantity: normalizedQty,         // base unit
                  unit: baseUnit,
                  purchasePrice: unitPrice,        // per form unit
                  currency: 'USD',
                  costTotal: lineTotal,
                  date: movementDateStr,           // STRING per schema
                  notes: `Auto-received from requisition ${doc._id}${notes ? ' - ' + notes : ''}`,
                  direction: 'inbound',
                  sourceType: 'Requisition',
                  sourceId: String(doc._id),
                },
              ],
              { session }
            );

            console.log('    [OK] inventory row created:', created?.[0]?._id);
            resultPayload.movementsCreated += 1;
          } catch (createErr) {
            console.error('    [ERR] Inventory.create failed:', createErr?.message);
            if (createErr?.errors) console.error('    [ERR] validation:', createErr.errors);
            throw createErr;
          }

          // Update stock
          try {
            ing.stock = safeToNum(ing.stock, 0) + normalizedQty;
            await ing.save({ session });
            console.log('    [OK] ingredient stock updated:', ing._id, '->', ing.stock);
          } catch (stockErr) {
            console.error('    [ERR] Ingredient.save failed:', stockErr?.message);
            if (stockErr?.errors) console.error('    [ERR] validation:', stockErr.errors);
            throw stockErr;
          }
        }
      } else {
        console.log('[TX] movements were already posted earlier; skipping creation');
      }
    }); // withTransaction

    console.log('--- completeRequisition:commit ---');
    if (resultPayload.alreadyPosted) {
      return res.json({ message: 'Already completed (inventory posted)', ...resultPayload });
    }
    return res.json({ message: 'Requisition completed and inventory posted', ...resultPayload });
  } catch (err) {
    console.error('--- completeRequisition:ERROR ---');
    console.error(err?.message || err);
    if (err?.errors) console.error('validation errors:', err.errors);

    const status = err?.statusCode || 500;
    return res.status(status).json({
      message: status === 404 ? 'Requisition not found'
        : (status === 400 ? 'Bad Request' : 'Failed to complete requisition'),
      error: err?.message || String(err),
    });
  } finally {
    console.log('--- completeRequisition:finally (endSession) ---');
    session.endSession();
  }
};



// PUT /api/requisitions/:id/item/:itemId/complete
// controllers/requisitionController.js - Enhanced completion function
// exports.completeRequisition = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { actualQuantities, completedBy, notes } = req.body;
    
//     const doc = await Requisition.findById(id);
//     if (!doc) return res.status(404).json({ message: 'Requisition not found' });
    
//     // Check if already completed
//     if (doc.status === 'completed') {
//       return res.status(400).json({ message: 'Requisition is already completed' });
//     }
    
//     // Update items with actual quantities
//     if (Array.isArray(doc.items) && actualQuantities) {
//       let allItemsCompleted = true;
      
//       doc.items.forEach((item) => {
//         const itemId = item._id.toString();
//         if (actualQuantities[itemId] !== undefined && actualQuantities[itemId] !== null) {
//           item.actualQuantity = actualQuantities[itemId];
//           item.status = 'completed';
//         } else {
//           // If any item doesn't have actual quantity, mark as not fully completed
//           allItemsCompleted = false;
//         }
//       });
      
//       // Only mark header as completed if all items are completed
//       if (allItemsCompleted) {
//         doc.status = 'completed';
//         doc.completedAt = new Date();
//         doc.completedBy = completedBy;
//         doc.notes = notes;
//       } else {
//         // Partial completion - keep header status as approved
//         doc.status = 'approved';
//       }
//     } else {
//       // For line-level requisitions or missing actualQuantities
//       doc.status = 'completed';
//       doc.completedAt = new Date();
//       doc.completedBy = completedBy;
//       doc.notes = notes;
//     }

//     await doc.save();
    
//     return res.json({ 
//       message: 'Requisition completed successfully', 
//       requisition: doc 
//     });
//   } catch (err) {
//     return res.status(500).json({ 
//       message: 'Failed to complete requisition', 
//       error: err.message 
//     });
//   }
// };
