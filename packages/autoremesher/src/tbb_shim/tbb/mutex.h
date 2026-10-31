/*
 *  Sequential stand-in for tbb::mutex under wasm32 (wraps std::mutex).
 *  Upstream includes this header but locks with std::mutex; provide a
 *  resolving stub so the include succeeds.
 */
#ifndef WASM_BUILDS_TBB_SHIM_MUTEX_H
#define WASM_BUILDS_TBB_SHIM_MUTEX_H

#include <mutex>

namespace tbb {

class mutex : public std::mutex {
public:
    typedef std::lock_guard<mutex> scoped_lock;
};

} // namespace tbb

#endif
