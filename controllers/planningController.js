const Planning = require('../models/Planning');

// @desc    Get all planning entries
// @route   GET /api/planning
// @access  Private
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await Planning.find().populate('menus');
    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch plans', error: err.message });
  }
};

// @desc    Create a new plan
// @route   POST /api/planning
// @access  Private
exports.createPlan = async (req, res) => {
  try {
    const { date, base, menus, notes } = req.body;

    if (!date || !base || !menus || !Array.isArray(menus)) {
      return res.status(400).json({ message: 'Missing required fields or invalid format' });
    }

    const plan = await Planning.create({ date, base, menus, notes });
    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create plan', error: err.message });
  }
};

// @desc    Update an existing plan
// @route   PUT /api/planning/:id
// @access  Private
exports.updatePlan = async (req, res) => {
  try {
    const updated = await Planning.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Plan not found' });

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update plan', error: err.message });
  }
};

// @desc    Delete a plan
// @route   DELETE /api/planning/:id
// @access  Private
exports.deletePlan = async (req, res) => {
  try {
    const deleted = await Planning.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Plan not found' });

    res.status(200).json({ message: 'Plan deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete plan', error: err.message });
  }
};
