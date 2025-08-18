const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Menu = require('../models/Menu');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const Planning = require('../models/Planning');
const Requisition = require('../models/Requisition');

let Production = null;
try { Production = require('../models/Production'); } catch (_) { Production = null; }

// simple admin-only list (optional)
exports.getAllUsers = async (_req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;

    const updatedUser = await user.save();
    res.status(200).json({
      message: 'User updated successfully',
      user: { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
};

// paged + search
exports.adminListUsers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const q = search
      ? {
          $or: [
            { name:  { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { role:  { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      User.find(q).select('-password').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      User.countDocuments(q),
    ]);

    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list users', error: err.message });
  }
};

exports.adminCreateUser = async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password are required' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create user', error: err.message });
  }
};

exports.adminUpdateUser = async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (password) user.password = await bcrypt.hash(password, 12);

    const updated = await user.save();
    res.json({ id: updated._id, name: updated.name, email: updated.email, role: updated.role });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
};

exports.adminDeleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
};

exports.adminSetUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: 'role is required' });
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: '-password' }
    );
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to set role', error: err.message });
  }
};

exports.adminGetStats = async (_req, res) => {
  try {
    const [
      usersCount,
      menusCount,
      recipesCount,
      ingredientsCount,
      plansCount,
      requisitionsCount,
      pendingReqs,
      approvedReqs,
      completedReqs,
      productionsCount,
    ] = await Promise.all([
      User.countDocuments(),
      Menu.countDocuments(),
      Recipe.countDocuments(),
      Ingredient.countDocuments(),
      Planning.countDocuments(),
      Requisition.countDocuments(),
      Requisition.countDocuments({ status: 'pending' }),
      Requisition.countDocuments({ status: 'approved' }),
      Requisition.countDocuments({ status: 'completed' }),
      Production && Production.countDocuments ? Production.countDocuments() : 0,
    ]);

    res.json({
      users: usersCount,
      menus: menusCount,
      recipes: recipesCount,
      ingredients: ingredientsCount,
      plans: plansCount,
      requisitions: {
        total: requisitionsCount,
        pending: pendingReqs,
        approved: approvedReqs,
        completed: completedReqs,
      },
      productions: productionsCount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
  }
};

exports.adminListRequisitions = async (req, res) => {
  try {
    const { status, base, plan } = req.query;
    const q = {};
    if (status && status !== 'all') q.status = status;
    if (base) q.base = base;
    if (plan) q.plan = plan;

    const items = await Requisition.find(q).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Failed to list requisitions', error: err.message });
  }
};

exports.adminBulkUpdateRequisitionStatus = async (req, res) => {
  try {
    const { ids = [], status } = req.body;
    if (!Array.isArray(ids) || !ids.length || !status) {
      return res.status(400).json({ message: 'ids[] and status are required' });
    }
    const result = await Requisition.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );
    res.json({ modified: result.modifiedCount || 0 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update requisitions', error: err.message });
  }
};
