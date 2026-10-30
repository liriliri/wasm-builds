/*
 *  Embind bindings for Isotropic Remesher.
 *
 *  Upstream: https://github.com/huxingyi/isotropicremesher
 *  Copyright (c) 2020-2021 Jeremy HU <jeremy-at-dust3d dot org>. All rights reserved.
 *  Licensed under the MIT License, see LICENSE.
 */
#include <cstdint>
#include <vector>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "vector3.h"
#include "isotropicremesher.h"
#include "isotropichalfedgemesh.h"

using namespace emscripten;

namespace {

// Embind cannot take a TypedArray as std::vector<T> by value, so read incoming
// Float64Array/Uint32Array/Array through emscripten::val instead.
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
    std::vector<Vector3> &vertices,
    std::vector<std::vector<size_t>> &triangles)
{
    vertices.reserve(vertexPositions.size() / 3);
    for (size_t i = 0; i + 2 < vertexPositions.size(); i += 3) {
        vertices.push_back(Vector3(vertexPositions[i],
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

// Runs the remesher and returns {vertices: Float64Array, indices: Uint32Array}.
val remesh(const val &vertexPositions,
    const val &triangleIndices,
    int iteration,
    double targetTriangleCount,
    double targetEdgeLength,
    double sharpEdgeIncludedAngle)
{
    const std::vector<double> positions = copyNumericArray<double>(vertexPositions);
    const std::vector<uint32_t> indicesIn = copyNumericArray<uint32_t>(triangleIndices);

    std::vector<Vector3> vertices;
    std::vector<std::vector<size_t>> triangles;
    buildMesh(positions, indicesIn, vertices, triangles);

    IsotropicRemesher remesher(&vertices, &triangles);
    if (sharpEdgeIncludedAngle > 0)
        remesher.setSharpEdgeIncludedAngle(sharpEdgeIncludedAngle);
    if (targetEdgeLength > 0)
        remesher.setTargetEdgeLength(targetEdgeLength);
    if (targetTriangleCount > 0)
        remesher.setTargetTriangleCount((size_t)targetTriangleCount);
    remesher.remesh(iteration < 0 ? 0 : (size_t)iteration);

    IsotropicHalfedgeMesh *halfedgeMesh = remesher.remeshedHalfedgeMesh();
    if (nullptr == halfedgeMesh)
        return val::null();

    std::vector<double> outVertices;
    std::vector<uint32_t> outIndices;
    size_t outputIndex = 0;

    for (IsotropicHalfedgeMesh::Vertex *vertex = halfedgeMesh->moveToNextVertex(nullptr);
            nullptr != vertex;
            vertex = halfedgeMesh->moveToNextVertex(vertex)) {
        vertex->outputIndex = outputIndex++;
        outVertices.push_back(vertex->position[0]);
        outVertices.push_back(vertex->position[1]);
        outVertices.push_back(vertex->position[2]);
    }

    for (IsotropicHalfedgeMesh::Face *face = halfedgeMesh->moveToNextFace(nullptr);
            nullptr != face;
            face = halfedgeMesh->moveToNextFace(face)) {
        outIndices.push_back((uint32_t)face->halfedge->previousHalfedge->startVertex->outputIndex);
        outIndices.push_back((uint32_t)face->halfedge->startVertex->outputIndex);
        outIndices.push_back((uint32_t)face->halfedge->nextHalfedge->startVertex->outputIndex);
    }

    val result = val::object();
    result.set("vertices", val::global("Float64Array").new_(val::array(outVertices)));
    result.set("indices", val::global("Uint32Array").new_(val::array(outIndices)));
    return result;
}

double initialAverageEdgeLength(const val &vertexPositions,
    const val &triangleIndices)
{
    const std::vector<double> positions = copyNumericArray<double>(vertexPositions);
    const std::vector<uint32_t> indicesIn = copyNumericArray<uint32_t>(triangleIndices);

    std::vector<Vector3> vertices;
    std::vector<std::vector<size_t>> triangles;
    buildMesh(positions, indicesIn, vertices, triangles);

    IsotropicRemesher remesher(&vertices, &triangles);
    return remesher.initialAverageEdgeLength();
}

} // namespace

EMSCRIPTEN_BINDINGS(isotropicremesher)
{
    function("remesh", &remesh);
    function("initialAverageEdgeLength", &initialAverageEdgeLength);
}
