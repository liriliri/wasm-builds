/*
 *  Sequential stand-in for tbb::parallel_sort under wasm32.
 */
#ifndef WASM_BUILDS_TBB_SHIM_PARALLEL_SORT_H
#define WASM_BUILDS_TBB_SHIM_PARALLEL_SORT_H

#include <algorithm>
#include <functional>

namespace tbb {

template <typename RandomAccessIterator>
void parallel_sort(RandomAccessIterator first, RandomAccessIterator last)
{
    std::sort(first, last);
}

template <typename RandomAccessIterator, typename Compare>
void parallel_sort(RandomAccessIterator first, RandomAccessIterator last, const Compare &comp)
{
    std::sort(first, last, comp);
}

} // namespace tbb

#endif
