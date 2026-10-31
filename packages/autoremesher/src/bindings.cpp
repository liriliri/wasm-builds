/*
 *  Embind bindings for AutoRemesher.
 *
 *  Upstream: https://github.com/huxingyi/autoremesher
 *  Copyright (c) 2020-2026 Jeremy HU / Dust3D Project. All rights reserved.
 *  Licensed under the MIT License, see LICENSE.
 */
#include <cmath>
#include <cstdint>
#include <iostream>
#include <vector>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <AutoRemesher/AutoRemesher>

using namespace emscripten;

namespace {

template <typename T>
std::vector<T> copyNumericArray(const val &source)
{
    if (source.isUndefined() || source.isNull())
        return {};

    if (!source["length"].isNumber())
        return {};

    const size_t length = source["length"].as<size_t>();
    std::vector<T> out;
    out.reserve(length);
    for (size_t i = 0; i < length; ++i)
        out.push_back(source[i].as<T>());
    return out;
}

void buildMesh(const std::vector<double> &vertexPositions,
    const std::vector<uint32_t> &triangleIndices,
    std::vector<AutoRemesher::Vector3> &vertices,
    std::vector<std::vector<size_t>> &triangles)
{
    vertices.reserve(vertexPositions.size() / 3);
    for (size_t i = 0; i + 2 < vertexPositions.size(); i += 3) {
        vertices.push_back(AutoRemesher::Vector3(vertexPositions[i],
            vertexPositions[i + 1],
            vertexPositions[i + 2]));
    }

    triangles.reserve(triangleIndices.size() / 3);
    for (size_t i = 0; i + 2 < triangleIndices.size(); i += 3) {
        triangles.push_back(std::vector<size_t> {
            (size_t)triangleIndices[i],
            (size_t)triangleIndices[i + 1],
            (size_t)triangleIndices[i + 2]
        });
    }
}

// Optional doubles use NaN as "unset" so 0 remains a valid explicit value
// (e.g. anisotropy=0 disables it; adaptivity=0 skips the adaptive field).
// modelType: 0 = Organic (default), 1 = HardSurface.
val remesh(const val &vertexPositions,
    const val &triangleIndices,
    double targetTriangleCount,
    double scaling,
    int modelType,
    double gradientAdaptivity,
    double sharpEdgeDegrees,
    double anisotropy,
    double smoothNormalDegrees)
{
    const std::vector<double> positions = copyNumericArray<double>(vertexPositions);
    const std::vector<uint32_t> indicesIn = copyNumericArray<uint32_t>(triangleIndices);

    std::vector<AutoRemesher::Vector3> vertices;
    std::vector<std::vector<size_t>> triangles;
    buildMesh(positions, indicesIn, vertices, triangles);

    // Qualify the type: `using namespace emscripten` makes a bare AutoRemesher
    // ambiguous with the emscripten namespace lookup.
    AutoRemesher::AutoRemesher remesher(vertices, triangles);
    if (targetTriangleCount > 0)
        remesher.setTargetTriangleCount((size_t)targetTriangleCount);
    if (!std::isnan(scaling))
        remesher.setScaling(scaling);
    if (modelType == 1)
        remesher.setModelType(AutoRemesher::ModelType::HardSurface);
    if (!std::isnan(gradientAdaptivity))
        remesher.setGradientAdaptivity(gradientAdaptivity);
    if (!std::isnan(sharpEdgeDegrees))
        remesher.setSharpEdgeDegrees(sharpEdgeDegrees);
    if (!std::isnan(anisotropy))
        remesher.setAnisotropy(anisotropy);
    if (!std::isnan(smoothNormalDegrees))
        remesher.setSmoothNormalDegrees(smoothNormalDegrees);

    // Upstream logs a phase report (and assorted progress lines) to stderr on
    // every remesh. Mute for the wasm package; failure is still signaled by
    // remesh() returning false.
    const std::ios_base::iostate saved = std::cerr.rdstate();
    std::cerr.setstate(std::ios_base::failbit);
    const bool ok = remesher.remesh();
    std::cerr.clear(saved);

    if (!ok)
        return val::null();

    const std::vector<AutoRemesher::Vector3> &outVerts = remesher.remeshedVertices();
    const std::vector<std::vector<size_t>> &outFaces = remesher.remeshedQuads();

    std::vector<double> flatVertices;
    flatVertices.reserve(outVerts.size() * 3);
    for (const auto &v : outVerts) {
        flatVertices.push_back(v.x());
        flatVertices.push_back(v.y());
        flatVertices.push_back(v.z());
    }

    // Upstream's remeshedQuads() is really remeshedPolygons and may contain
    // triangles / n-gons. Keep the JS contract as stride-4 quads only.
    std::vector<uint32_t> flatIndices;
    flatIndices.reserve(outFaces.size() * 4);
    for (const auto &face : outFaces) {
        if (face.size() != 4)
            continue;
        flatIndices.push_back((uint32_t)face[0]);
        flatIndices.push_back((uint32_t)face[1]);
        flatIndices.push_back((uint32_t)face[2]);
        flatIndices.push_back((uint32_t)face[3]);
    }

    val result = val::object();
    result.set("vertices", val::global("Float64Array").new_(val::array(flatVertices)));
    result.set("indices", val::global("Uint32Array").new_(val::array(flatIndices)));
    return result;
}

} // namespace

EMSCRIPTEN_BINDINGS(autoremesher)
{
    function("remesh", &remesh);
}
