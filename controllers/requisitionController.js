const Requisition = require('../models/Requisition');

// @desc    Get all requisitions with filters
// @route   GET /api/requisitions
// @access  Private
exports.getRequisitions = async (req, res) => {
  try {
    const { status, supplier } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (supplier && supplier !== 'all') filter.supplier = supplier;

    const data = await Requisition.find(filter).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch requisitions', error: err.message });
  }
};

// @desc    Create a new requisition
// @route   POST /api/requisitions
// @access  Private
exports.createRequisition = async (req, res) => {
  try {
    const { date, item, quantity, unit, requestedBy, supplier, status } = req.body;

    if (!date || !item || !quantity || !unit || !requestedBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newReq = await Requisition.create({
      date, item, quantity, unit, requestedBy,
      supplier: supplier || 'Default Supplier',
      status: status || 'pending'
    });

    res.status(201).json(newReq);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create requisition', error: err.message });
  }
};

// @desc    Update requisition
// @route   PUT /api/requisitions/:id
// @access  Private
exports.updateRequisition = async (req, res) => {
  try {
    const updated = await Requisition.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Requisition not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update requisition', error: err.message });
  }
};

// @desc    Delete requisition
// @route   DELETE /api/requisitions/:id
// @access  Private
exports.deleteRequisition = async (req, res) => {
  try {
    const deleted = await Requisition.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Requisition not found' });
    res.json({ message: 'Requisition deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete requisition', error: err.message });
  }
};

// @desc    Import requisitions in bulk (e.g. from generated menus)
// @route   POST /api/requisitions/import
// @access  Private
exports.importGenerated = async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Invalid data format. Expected an array.' });
    }

    const inserted = await Requisition.insertMany(req.body);
    res.status(201).json({ message: 'Imported successfully', count: inserted.length });
  } catch (err) {
    res.status(500).json({ message: 'Bulk import failed', error: err.message });
  }
};
