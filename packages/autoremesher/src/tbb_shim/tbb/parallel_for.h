/*
 *  Sequential stand-in for tbb::parallel_for under wasm32.
 */
#ifndef WASM_BUILDS_TBB_SHIM_PARALLEL_FOR_H
#define WASM_BUILDS_TBB_SHIM_PARALLEL_FOR_H

#include "blocked_range.h"

namespace tbb {

template <typename Range, typename Body>
void parallel_for(const Range &range, const Body &body)
{
    if (!range.empty())
        body(range);
}

} // namespace tbb

#endif
