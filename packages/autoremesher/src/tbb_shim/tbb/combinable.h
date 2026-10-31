/*
 *  Sequential stand-in for tbb::combinable under wasm32.
 *  Included by upstream; currently unused, but must resolve.
 */
#ifndef WASM_BUILDS_TBB_SHIM_COMBINABLE_H
#define WASM_BUILDS_TBB_SHIM_COMBINABLE_H

#include <utility>

namespace tbb {

template <typename T>
class combinable {
public:
    combinable()
        : m_value()
    {
    }

    explicit combinable(const T &value)
        : m_value(value)
    {
    }

    template <typename F>
    explicit combinable(F finit)
        : m_value(finit())
    {
    }

    T &local() { return m_value; }
    const T &local() const { return m_value; }

    template <typename BinaryFunc>
    T combine(BinaryFunc /*f*/) const
    {
        return m_value;
    }

    void clear() { m_value = T(); }

private:
    T m_value;
};

} // namespace tbb

#endif
