/*
 *  Sequential stand-in for tbb::blocked_range under wasm32.
 *  Real TBB does not build for wasm (Unsupported machine word size).
 */
#ifndef WASM_BUILDS_TBB_SHIM_BLOCKED_RANGE_H
#define WASM_BUILDS_TBB_SHIM_BLOCKED_RANGE_H

#include <cstddef>

namespace tbb {

template <typename Value>
class blocked_range {
public:
    typedef Value const_iterator;
    typedef std::size_t size_type;

    blocked_range(Value begin, Value end, size_type /*grainsize*/ = 1)
        : m_begin(begin)
        , m_end(end)
    {
    }

    Value begin() const { return m_begin; }
    Value end() const { return m_end; }
    size_type size() const { return size_type(m_end - m_begin); }
    bool empty() const { return !(m_begin < m_end); }

private:
    Value m_begin;
    Value m_end;
};

} // namespace tbb

#endif
