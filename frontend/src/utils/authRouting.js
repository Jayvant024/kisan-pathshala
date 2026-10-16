export function roleHomePath(user) {
	return user?.role === 'admin' ? '/admin' : '/dashboard'
}