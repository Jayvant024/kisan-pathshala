import test from 'node:test'
import assert from 'node:assert/strict'
import { roleHomePath } from '../src/utils/authRouting.js'

test('admin accounts route to the admin dashboard', () => {
	assert.equal(roleHomePath({ id: 'admin-1', role: 'admin' }), '/admin')
})

test('farmer accounts route to the customer dashboard', () => {
	assert.equal(roleHomePath({ id: 'farmer-1', role: 'farmer' }), '/dashboard')
})

test('unknown roles do not receive admin routing', () => {
	assert.equal(roleHomePath(null), '/dashboard')
	assert.equal(roleHomePath({ id: 'user-1', role: 'manager' }), '/dashboard')
})